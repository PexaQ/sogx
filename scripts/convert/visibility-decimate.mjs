import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (!args.input || !args.route || !args.out) {
  console.error('Usage: node scripts/convert/visibility-decimate.mjs --input scene.ply --route route.json --out scene.vis.ply --keep 25%');
  process.exit(1);
}

const input = resolve(args.input);
const routePath = resolve(args.route);
const out = resolve(args.out);
const keep = args.keep ?? '25%';
const nearDistance = Number(args.nearDistance ?? 2.5);

const route = JSON.parse(await readFile(routePath, 'utf8'));
const cameras = readRouteCameras(route);
const ply = parsePly(await readFile(input));
const keepCount = parseKeepCount(keep, ply.vertexCount);

if (!cameras.length) {
  throw new Error(`Route has no keyframes with position/target arrays: ${routePath}`);
}

const scores = [];
for (let index = 0; index < ply.vertexCount; index += 1) {
  scores.push({
    index,
    score: scoreVertex(ply.readVertex(index), cameras, nearDistance)
  });
}

scores.sort((a, b) => b.score - a.score || a.index - b.index);
const selected = new Set(scores.slice(0, keepCount).map((item) => item.index));

await mkdir(dirname(out), { recursive: true });
await writeFile(out, ply.writeSubset(selected));
await writeFile(`${out}.visibility-report.json`, JSON.stringify({
  input,
  route: routePath,
  out,
  keep,
  inputVertices: ply.vertexCount,
  outputVertices: keepCount,
  nearDistance,
  format: ply.format,
  note: 'Route-aware heuristic decimator. Use as Candidate 3 scaffold, not as a validated visual-quality method.'
}, null, 2));

console.log(`Wrote ${keepCount}/${ply.vertexCount} vertices to ${out}`);

function parsePly(buffer) {
  const marker = Buffer.from('end_header');
  const markerIndex = buffer.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('PLY header missing end_header');
  }

  const headerEnd = findLineEnd(buffer, markerIndex + marker.length);
  const headerText = buffer.subarray(0, headerEnd).toString('utf8');
  const lines = headerText.split(/\r?\n/).filter(Boolean);
  const formatLine = lines.find((line) => line.startsWith('format '));
  const format = formatLine?.split(/\s+/)[1];

  if (!['ascii', 'binary_little_endian'].includes(format)) {
    throw new Error(`Unsupported PLY format: ${format}`);
  }

  const vertexElementLineIndex = lines.findIndex((line) => line.startsWith('element vertex '));
  if (vertexElementLineIndex < 0) {
    throw new Error('PLY has no vertex element');
  }

  const vertexCount = Number(lines[vertexElementLineIndex].split(/\s+/)[2]);
  if (!Number.isInteger(vertexCount) || vertexCount < 0) {
    throw new Error(`Invalid vertex count: ${lines[vertexElementLineIndex]}`);
  }

  const nextElementIndex = lines.findIndex((line, index) => index > vertexElementLineIndex && line.startsWith('element '));
  if (nextElementIndex >= 0) {
    throw new Error('Only vertex-only Gaussian PLY files are supported by this prototype decimator');
  }

  const propertyLines = lines.slice(vertexElementLineIndex + 1).filter((line) => line.startsWith('property '));
  const properties = propertyLines.map(parseProperty);
  const propertyIndex = new Map(properties.map((property, index) => [property.name, index]));

  for (const key of ['x', 'y', 'z']) {
    if (!propertyIndex.has(key)) {
      throw new Error(`PLY vertex property "${key}" is required`);
    }
  }

  const bodyStart = headerEnd;
  if (format === 'ascii') {
    return parseAsciiPly(buffer, headerText, bodyStart, vertexCount, properties, propertyIndex);
  }
  return parseBinaryPly(buffer, headerText, bodyStart, vertexCount, properties, propertyIndex);
}

function parseAsciiPly(buffer, headerText, bodyStart, vertexCount, properties, propertyIndex) {
  const rows = buffer.subarray(bodyStart).toString('utf8').split(/\r?\n/).filter((line) => line.trim().length);
  if (rows.length < vertexCount) {
    throw new Error(`ASCII PLY has ${rows.length} rows, expected ${vertexCount}`);
  }

  return {
    format: 'ascii',
    vertexCount,
    readVertex(index) {
      const values = rows[index].trim().split(/\s+/).map(Number);
      return makeVertexReader(values, propertyIndex);
    },
    writeSubset(selected) {
      const outRows = [];
      for (let index = 0; index < vertexCount; index += 1) {
        if (selected.has(index)) {
          outRows.push(rows[index]);
        }
      }
      return Buffer.from(`${rewriteVertexCount(headerText, selected.size)}${outRows.join('\n')}\n`);
    }
  };
}

function parseBinaryPly(buffer, headerText, bodyStart, vertexCount, properties, propertyIndex) {
  const stride = properties.reduce((sum, property) => sum + property.size, 0);
  const expectedEnd = bodyStart + stride * vertexCount;
  if (buffer.length < expectedEnd) {
    throw new Error(`Binary PLY is truncated: expected at least ${expectedEnd} bytes, got ${buffer.length}`);
  }

  const offsets = [];
  let offset = 0;
  for (const property of properties) {
    offsets.push(offset);
    offset += property.size;
  }

  return {
    format: 'binary_little_endian',
    vertexCount,
    readVertex(index) {
      const base = bodyStart + stride * index;
      return {
        get(name) {
          const propIndex = propertyIndex.get(name);
          if (propIndex === undefined) {
            return undefined;
          }
          return readBinaryValue(buffer, base + offsets[propIndex], properties[propIndex].type);
        }
      };
    },
    writeSubset(selected) {
      const chunks = [Buffer.from(rewriteVertexCount(headerText, selected.size))];
      for (let index = 0; index < vertexCount; index += 1) {
        if (selected.has(index)) {
          const rowStart = bodyStart + stride * index;
          chunks.push(buffer.subarray(rowStart, rowStart + stride));
        }
      }
      return Buffer.concat(chunks);
    }
  };
}

function makeVertexReader(values, propertyIndex) {
  return {
    get(name) {
      const index = propertyIndex.get(name);
      return index === undefined ? undefined : values[index];
    }
  };
}

function scoreVertex(vertex, cameras, nearDistance) {
  const point = [vertex.get('x'), vertex.get('y'), vertex.get('z')];
  const opacity = sigmoid(vertex.get('opacity') ?? 0);
  const scale = Math.exp(((vertex.get('scale_0') ?? -4) + (vertex.get('scale_1') ?? -4) + (vertex.get('scale_2') ?? -4)) / 3);

  let bestVisibility = 0;
  let nearest = Infinity;

  for (const camera of cameras) {
    const toPoint = sub(point, camera.position);
    const distance = length(toPoint);
    nearest = Math.min(nearest, distance);
    if (distance <= 1e-5) {
      bestVisibility = Math.max(bestVisibility, 1);
      continue;
    }

    const viewCos = dot(normalize(toPoint), camera.forward);
    const fovCos = Math.cos((camera.fov * Math.PI / 180) * 0.65);
    const inView = Math.max(0, (viewCos - fovCos) / Math.max(1e-5, 1 - fovCos));
    const distanceFalloff = 1 / (1 + distance * 0.15);
    const projectedScale = Math.min(1, scale / Math.max(0.1, distance) * 50);
    bestVisibility = Math.max(bestVisibility, inView * distanceFalloff + projectedScale * 0.15);
  }

  const nearBoost = nearest <= nearDistance ? 0.6 : 0;
  return bestVisibility + opacity * 0.25 + nearBoost;
}

function readRouteCameras(route) {
  return (route.keyframes ?? [])
    .filter((keyframe) => Array.isArray(keyframe.position) && Array.isArray(keyframe.target))
    .map((keyframe) => ({
      position: keyframe.position.map(Number),
      target: keyframe.target.map(Number),
      forward: normalize(sub(keyframe.target.map(Number), keyframe.position.map(Number))),
      fov: Number(keyframe.fov ?? 65)
    }));
}

function parseProperty(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 3 || parts[0] !== 'property') {
    throw new Error(`Unsupported PLY property line: ${line}`);
  }
  return {
    type: parts[1],
    name: parts[2],
    size: typeSize(parts[1])
  };
}

function typeSize(type) {
  const sizes = {
    char: 1,
    uchar: 1,
    int8: 1,
    uint8: 1,
    short: 2,
    ushort: 2,
    int16: 2,
    uint16: 2,
    int: 4,
    uint: 4,
    int32: 4,
    uint32: 4,
    float: 4,
    float32: 4,
    double: 8,
    float64: 8
  };
  if (!sizes[type]) {
    throw new Error(`Unsupported PLY property type: ${type}`);
  }
  return sizes[type];
}

function readBinaryValue(buffer, offset, type) {
  switch (type) {
    case 'char':
    case 'int8':
      return buffer.readInt8(offset);
    case 'uchar':
    case 'uint8':
      return buffer.readUInt8(offset);
    case 'short':
    case 'int16':
      return buffer.readInt16LE(offset);
    case 'ushort':
    case 'uint16':
      return buffer.readUInt16LE(offset);
    case 'int':
    case 'int32':
      return buffer.readInt32LE(offset);
    case 'uint':
    case 'uint32':
      return buffer.readUInt32LE(offset);
    case 'float':
    case 'float32':
      return buffer.readFloatLE(offset);
    case 'double':
    case 'float64':
      return buffer.readDoubleLE(offset);
    default:
      throw new Error(`Unsupported PLY property type: ${type}`);
  }
}

function rewriteVertexCount(headerText, count) {
  return headerText.replace(/element vertex \d+/, `element vertex ${count}`);
}

function parseKeepCount(value, vertexCount) {
  const text = String(value);
  if (text.endsWith('%')) {
    const fraction = Number(text.slice(0, -1)) / 100;
    if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
      throw new Error(`Invalid keep percentage: ${value}`);
    }
    return Math.max(1, Math.floor(vertexCount * fraction));
  }
  const count = Number(text);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Invalid keep count: ${value}`);
  }
  return Math.min(vertexCount, count);
}

function findLineEnd(buffer, index) {
  let cursor = index;
  while (cursor < buffer.length && buffer[cursor] !== 0x0a) {
    cursor += 1;
  }
  return Math.min(buffer.length, cursor + 1);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v) {
  const len = length(v);
  return len > 1e-8 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, -1];
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

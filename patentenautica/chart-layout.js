const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

const normalizeVector = ({ x, y }) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

export function chartAlignment(chart) {
  const alignment = chart.alignment || {};
  const rotationDegrees = Number(alignment.rotationDegrees || 0);
  const rotationRadians = degreesToRadians(rotationDegrees);
  return {
    width: chart.width,
    height: chart.height,
    sourceWidth: alignment.sourceWidth || chart.width,
    sourceHeight: alignment.sourceHeight || chart.height,
    rotationDegrees,
    rotationRadians,
    cosine: Math.cos(rotationRadians),
    sine: Math.sin(rotationRadians),
  };
}

export function projectChartPoint(chart, point) {
  const calibration = chart.calibration;
  const longitudeMinutes = (point.lon - calibration.longitudeOrigin) * 60;
  const latitudeMinutes = (point.lat - 42) * 60;
  const longitudeAxis =
    calibration.meridianX +
    calibration.pixelsPerLongitudeMinute * longitudeMinutes;
  const latitudeAxis =
    calibration.parallelY +
    calibration.pixelsPerLatitudeMinute *
      (calibration.referenceLatitudeMinutes - latitudeMinutes);
  const divisor = 1 + calibration.meridianSlope * calibration.parallelSlope;
  const sourceY =
    (latitudeAxis + calibration.parallelSlope * longitudeAxis) / divisor;
  const sourceX = longitudeAxis - calibration.meridianSlope * sourceY;
  const geometry = chartAlignment(chart);
  const relativeX = sourceX - geometry.sourceWidth / 2;
  const relativeY = sourceY - geometry.sourceHeight / 2;

  return {
    x:
      geometry.cosine * relativeX -
      geometry.sine * relativeY +
      geometry.width / 2,
    y:
      geometry.sine * relativeX +
      geometry.cosine * relativeY +
      geometry.height / 2,
  };
}

export function segmentIntersectsRect(start, end, rect, padding = 0) {
  const left = rect.left - padding;
  const right = rect.left + rect.width + padding;
  const top = rect.top - padding;
  const bottom = rect.top + rect.height + padding;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const p = [-deltaX, deltaX, -deltaY, deltaY];
  const q = [start.x - left, right - start.x, start.y - top, bottom - start.y];
  let minimum = 0;
  let maximum = 1;

  for (let index = 0; index < p.length; index += 1) {
    if (p[index] === 0) {
      if (q[index] < 0) return false;
      continue;
    }
    const ratio = q[index] / p[index];
    if (p[index] < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return false;
  }
  return true;
}

export function rectsOverlap(first, second, padding = 0) {
  return !(
    first.left + first.width + padding <= second.left ||
    second.left + second.width + padding <= first.left ||
    first.top + first.height + padding <= second.top ||
    second.top + second.height + padding <= first.top
  );
}

function circleIntersectsRect(point, radius, rect) {
  const closestX = clamp(point.x, rect.left, rect.left + rect.width);
  const closestY = clamp(point.y, rect.top, rect.top + rect.height);
  return Math.hypot(point.x - closestX, point.y - closestY) < radius;
}

function candidatesForLabel({
  marker,
  otherMarker,
  width,
  height,
  bounds,
  route,
}) {
  const edge = 20;
  const gap = 58;
  const positions = [
    { left: marker.x + gap, top: marker.y - height / 2 },
    { left: marker.x - gap - width, top: marker.y - height / 2 },
    { left: marker.x - width / 2, top: marker.y - gap - height },
    { left: marker.x - width / 2, top: marker.y + gap },
    { left: marker.x + gap, top: marker.y - gap - height },
    { left: marker.x - gap - width, top: marker.y - gap - height },
    { left: marker.x + gap, top: marker.y + gap },
    { left: marker.x - gap - width, top: marker.y + gap },
  ];
  const away = normalizeVector({
    x: marker.x - otherMarker.x,
    y: marker.y - otherMarker.y,
  });
  const seen = new Set();

  return positions
    .map((position) => {
      const left = clamp(position.left, edge, bounds.width - width - edge);
      const top = clamp(position.top, edge, bounds.height - height - edge);
      const key = `${Math.round(left)}:${Math.round(top)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const rect = { left, top, width, height };
      if (segmentIntersectsRect(route.start, route.end, rect, 20)) return null;
      if (circleIntersectsRect(marker, 43, rect)) return null;
      if (circleIntersectsRect(otherMarker, 43, rect)) return null;
      const direction = normalizeVector({
        x: left + width / 2 - marker.x,
        y: top + height / 2 - marker.y,
      });
      const clampDistance = Math.hypot(
        left - position.left,
        top - position.top,
      );
      return {
        ...rect,
        score:
          (direction.x * away.x + direction.y * away.y) * 1000 -
          clampDistance * 2,
      };
    })
    .filter(Boolean)
    .sort((first, second) => second.score - first.score);
}

export function placeRouteLabels({ start, end, labels, bounds, height = 54 }) {
  const route = { start, end };
  const firstCandidates = candidatesForLabel({
    marker: start,
    otherMarker: end,
    width: labels[0].width,
    height,
    bounds,
    route,
  });
  const secondCandidates = candidatesForLabel({
    marker: end,
    otherMarker: start,
    width: labels[1].width,
    height,
    bounds,
    route,
  });
  let bestPair = null;

  for (const first of firstCandidates) {
    for (const second of secondCandidates) {
      if (rectsOverlap(first, second, 18)) continue;
      const score = first.score + second.score;
      if (!bestPair || score > bestPair.score) {
        bestPair = { score, layouts: [first, second] };
      }
    }
  }

  if (bestPair) return bestPair.layouts;
  if (firstCandidates[0]) return [firstCandidates[0], null];
  if (secondCandidates[0]) return [null, secondCandidates[0]];
  return [null, null];
}

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
    width: alignment.width || chart.width,
    height: alignment.height || chart.height,
    sourceWidth: alignment.sourceWidth || chart.width,
    sourceHeight: alignment.sourceHeight || chart.height,
    rotationDegrees,
    rotationRadians,
    cosine: Math.cos(rotationRadians),
    sine: Math.sin(rotationRadians),
  };
}

export function transformChartPoint(chart, point) {
  const matrix = chart.projectionTransform?.matrix;
  if (!Array.isArray(matrix) || matrix.length !== 9) return point;
  const divisor = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  if (!Number.isFinite(divisor) || Math.abs(divisor) < Number.EPSILON)
    return point;
  return {
    x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / divisor,
    y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / divisor,
  };
}

function alignChartPoint(chart, point) {
  const geometry = chartAlignment(chart);
  const relativeX = point.x - geometry.sourceWidth / 2;
  const relativeY = point.y - geometry.sourceHeight / 2;

  return transformChartPoint(chart, {
    x:
      geometry.cosine * relativeX -
      geometry.sine * relativeY +
      geometry.width / 2,
    y:
      geometry.sine * relativeX +
      geometry.cosine * relativeY +
      geometry.height / 2,
  });
}

function clipLineToBounds(first, second, bounds) {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  const intersections = [];
  const add = (x, y) => {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < -0.001 ||
      x > bounds.width + 0.001 ||
      y < -0.001 ||
      y > bounds.height + 0.001
    )
      return;
    if (
      intersections.some((point) => Math.hypot(point.x - x, point.y - y) < 0.01)
    )
      return;
    intersections.push({
      x: clamp(x, 0, bounds.width),
      y: clamp(y, 0, bounds.height),
    });
  };

  if (Math.abs(deltaX) > Number.EPSILON) {
    add(0, first.y + ((0 - first.x) * deltaY) / deltaX);
    add(bounds.width, first.y + ((bounds.width - first.x) * deltaY) / deltaX);
  }
  if (Math.abs(deltaY) > Number.EPSILON) {
    add(first.x + ((0 - first.y) * deltaX) / deltaY, 0);
    add(first.x + ((bounds.height - first.y) * deltaX) / deltaY, bounds.height);
  }

  if (intersections.length < 2) return [first, second];
  let longest = [intersections[0], intersections[1]];
  let longestDistance = 0;
  intersections.forEach((left, leftIndex) => {
    intersections.slice(leftIndex + 1).forEach((right) => {
      const distance = Math.hypot(right.x - left.x, right.y - left.y);
      if (distance > longestDistance) {
        longestDistance = distance;
        longest = [left, right];
      }
    });
  });
  return longest;
}

function nearestLineEnd(point, line) {
  return [...line].sort(
    (left, right) =>
      Math.hypot(point.x - left.x, point.y - left.y) -
      Math.hypot(point.x - right.x, point.y - right.y),
  )[0];
}

function polygonBounds(points) {
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function interpolateBorderTick(ticks, value, field) {
  if (!Array.isArray(ticks) || ticks.length < 2) return null;
  const sorted = [...ticks].sort((left, right) => left.minutes - right.minutes);
  let lower = sorted[0];
  let upper = sorted[1];
  if (value >= sorted.at(-1).minutes) {
    lower = sorted.at(-2);
    upper = sorted.at(-1);
  } else if (value > sorted[0].minutes) {
    const upperIndex = sorted.findIndex((tick) => tick.minutes >= value);
    lower = sorted[upperIndex - 1];
    upper = sorted[upperIndex];
  }
  const interval = upper.minutes - lower.minutes;
  if (
    !interval ||
    !Number.isFinite(lower[field]) ||
    !Number.isFinite(upper[field])
  )
    return null;
  const ratio = (value - lower.minutes) / interval;
  return lower[field] + (upper[field] - lower[field]) * ratio;
}

function lineIntersection(first, second) {
  const [firstStart, firstEnd] = first;
  const [secondStart, secondEnd] = second;
  const firstDelta = {
    x: firstEnd.x - firstStart.x,
    y: firstEnd.y - firstStart.y,
  };
  const secondDelta = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y,
  };
  const divisor =
    firstDelta.x * secondDelta.y - firstDelta.y * secondDelta.x;
  if (Math.abs(divisor) < Number.EPSILON) return null;
  const offset = {
    x: secondStart.x - firstStart.x,
    y: secondStart.y - firstStart.y,
  };
  const position =
    (offset.x * secondDelta.y - offset.y * secondDelta.x) / divisor;
  return {
    x: firstStart.x + position * firstDelta.x,
    y: firstStart.y + position * firstDelta.y,
  };
}

function projectMeasuredBorderGuides(chart, point) {
  const calibration = chart.borderCalibration;
  const longitude = calibration?.longitude;
  const latitude = calibration?.latitude;
  if (
    !calibration?.sourceWidth ||
    !calibration?.sourceHeight ||
    !longitude ||
    !latitude
  )
    return null;
  const longitudeMinutes = (point.lon - longitude.originDegrees) * 60;
  const latitudeMinutes = (point.lat - latitude.originDegrees) * 60;
  const horizontalScale = chart.width / calibration.sourceWidth;
  const verticalScale = chart.height / calibration.sourceHeight;
  const topX = interpolateBorderTick(
    longitude.ticks,
    longitudeMinutes,
    "topX",
  );
  const bottomX = interpolateBorderTick(
    longitude.ticks,
    longitudeMinutes,
    "bottomX",
  );
  const leftY = interpolateBorderTick(
    latitude.ticks,
    latitudeMinutes,
    "leftY",
  );
  const rightY = interpolateBorderTick(
    latitude.ticks,
    latitudeMinutes,
    "rightY",
  );
  if (![topX, bottomX, leftY, rightY].every(Number.isFinite)) return null;
  const longitudeGuide = [
    { x: topX * horizontalScale, y: 0 },
    { x: bottomX * horizontalScale, y: chart.height },
  ];
  const latitudeGuide = [
    { x: 0, y: leftY * verticalScale },
    { x: chart.width, y: rightY * verticalScale },
  ];
  const projectedPoint = lineIntersection(longitudeGuide, latitudeGuide);
  if (!projectedPoint) return null;
  return { point: projectedPoint, longitudeGuide, latitudeGuide };
}

export function projectChartGuides(chart, point) {
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
  let projectedPoint = alignChartPoint(chart, { x: sourceX, y: sourceY });
  let longitudeGuide = clipLineToBounds(
    alignChartPoint(chart, { x: longitudeAxis, y: 0 }),
    alignChartPoint(chart, {
      x: longitudeAxis - calibration.meridianSlope * geometry.sourceHeight,
      y: geometry.sourceHeight,
    }),
    chart,
  );
  let latitudeGuide = clipLineToBounds(
    alignChartPoint(chart, { x: 0, y: latitudeAxis }),
    alignChartPoint(chart, {
      x: geometry.sourceWidth,
      y: latitudeAxis + calibration.parallelSlope * geometry.sourceWidth,
    }),
    chart,
  );
  const measuredGuides = projectMeasuredBorderGuides(chart, point);
  if (measuredGuides) {
    projectedPoint = measuredGuides.point;
    longitudeGuide = measuredGuides.longitudeGuide;
    latitudeGuide = measuredGuides.latitudeGuide;
  }
  const longitudeBorderAnchor = nearestLineEnd(projectedPoint, longitudeGuide);
  const latitudeBorderAnchor = nearestLineEnd(projectedPoint, latitudeGuide);

  return {
    point: projectedPoint,
    longitude: {
      line: longitudeGuide,
      borderAnchor: longitudeBorderAnchor,
      segment: [longitudeBorderAnchor, projectedPoint],
    },
    latitude: {
      line: latitudeGuide,
      borderAnchor: latitudeBorderAnchor,
      segment: [latitudeBorderAnchor, projectedPoint],
    },
  };
}

export function projectChartPoint(chart, point) {
  return projectChartGuides(chart, point).point;
}

export function projectChartTolerance(
  chart,
  point,
  toleranceMinutes = chart.answerToleranceMinutes || 0.3,
) {
  if (!Number.isFinite(toleranceMinutes) || toleranceMinutes <= 0)
    throw new TypeError("A tolerância deve ser um número positivo em minutos.");
  const delta = toleranceMinutes / 60;
  const center = projectChartGuides(chart, point);
  const coordinateCorners = [
    {
      corner: "northwest",
      lat: point.lat + delta,
      lon: point.lon - delta,
    },
    {
      corner: "northeast",
      lat: point.lat + delta,
      lon: point.lon + delta,
    },
    {
      corner: "southeast",
      lat: point.lat - delta,
      lon: point.lon + delta,
    },
    {
      corner: "southwest",
      lat: point.lat - delta,
      lon: point.lon - delta,
    },
  ];
  const polygon = coordinateCorners.map((corner) => ({
    ...corner,
    ...projectChartPoint(chart, corner),
  }));

  return {
    ...center,
    tolerance: {
      minutes: toleranceMinutes,
      latitude: {
        minimum: point.lat - delta,
        maximum: point.lat + delta,
      },
      longitude: {
        minimum: point.lon - delta,
        maximum: point.lon + delta,
      },
      polygon,
      bounds: polygonBounds(polygon),
    },
  };
}

export function toponymHighlightBounds(point, padding = 0) {
  const strokes = point.toponymHighlight || [];
  if (!strokes.length) return null;
  const left = Math.min(...strokes.flatMap((stroke) => [stroke.x1, stroke.x2]));
  const right = Math.max(
    ...strokes.flatMap((stroke) => [stroke.x1, stroke.x2]),
  );
  const top = Math.min(
    ...strokes.flatMap((stroke) => [
      stroke.y1 - stroke.width / 2,
      stroke.y2 - stroke.width / 2,
    ]),
  );
  const bottom = Math.max(
    ...strokes.flatMap((stroke) => [
      stroke.y1 + stroke.width / 2,
      stroke.y2 + stroke.width / 2,
    ]),
  );
  return {
    left: left - padding,
    top: top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
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
  obstacles,
  edge,
  gap,
  markerClearance,
  routePadding,
}) {
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
      if (segmentIntersectsRect(route.start, route.end, rect, routePadding))
        return null;
      if (circleIntersectsRect(marker, markerClearance, rect)) return null;
      if (circleIntersectsRect(otherMarker, markerClearance, rect)) return null;
      if (obstacles.some((obstacle) => rectsOverlap(rect, obstacle, 6)))
        return null;
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

export function placeRouteLabels({
  start,
  end,
  labels,
  bounds,
  height = 54,
  obstacles = [],
  edge = 20,
  gap = 58,
  markerClearance = 43,
  routePadding = 20,
}) {
  const route = { start, end };
  const firstCandidates = candidatesForLabel({
    marker: start,
    otherMarker: end,
    width: labels[0].width,
    height,
    bounds,
    route,
    obstacles,
    edge,
    gap,
    markerClearance,
    routePadding,
  });
  const secondCandidates = candidatesForLabel({
    marker: end,
    otherMarker: start,
    width: labels[1].width,
    height,
    bounds,
    route,
    obstacles,
    edge,
    gap,
    markerClearance,
    routePadding,
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

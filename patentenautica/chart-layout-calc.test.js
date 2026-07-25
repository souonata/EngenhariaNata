import { describe, expect, it } from "vitest";
import chartData from "./data/chart-points.json";
import {
  projectChartGuides,
  projectChartTolerance,
} from "./chart-layout.js";

const onBorder = (point) => {
  const epsilon = 0.01;
  return (
    Math.abs(point.x) < epsilon ||
    Math.abs(point.x - chartData.chart.width) < epsilon ||
    Math.abs(point.y) < epsilon ||
    Math.abs(point.y - chartData.chart.height) < epsilon
  );
};

describe("leitura geográfica da Carta 5/D", () => {
  it("faz cada meridiano passar pelas marcas medidas nas bordas", () => {
    const calibration = chartData.chart.borderCalibration;
    const horizontalScale =
      chartData.chart.width / calibration.sourceWidth;
    calibration.longitude.ticks.forEach((tick) => {
      const projection = projectChartGuides(chartData.chart, {
        lat: 42.5,
        lon: calibration.longitude.originDegrees + tick.minutes / 60,
      });
      const [top, bottom] = [...projection.longitude.line].sort(
        (left, right) => left.y - right.y,
      );
      expect(top.x / horizontalScale).toBeCloseTo(tick.topX, 6);
      expect(bottom.x / horizontalScale).toBeCloseTo(tick.bottomX, 6);
    });
  });

  it("faz cada paralelo passar pelas marcas medidas nas bordas", () => {
    const calibration = chartData.chart.borderCalibration;
    const verticalScale = chartData.chart.height / calibration.sourceHeight;
    calibration.latitude.ticks.forEach((tick) => {
      const projection = projectChartGuides(chartData.chart, {
        lat: calibration.latitude.originDegrees + tick.minutes / 60,
        lon: 10.5,
      });
      const [left, right] = [...projection.latitude.line].sort(
        (first, second) => first.x - second.x,
      );
      expect(left.y / verticalScale).toBeCloseTo(tick.leftY, 6);
      expect(right.y / verticalScale).toBeCloseTo(tick.rightY, 6);
    });
  });

  it("posiciona 11° 9,2′ a 20% do intervalo entre 9′ e 10′", () => {
    const atMinute = (minutes) => {
      const projection = projectChartGuides(chartData.chart, {
        lat: 42.36,
        lon: 11 + minutes / 60,
      });
      return [...projection.longitude.line].sort(
        (left, right) => left.y - right.y,
      )[1].x;
    };
    const minuteNine = atMinute(9);
    const minuteTen = atMinute(10);
    expect(atMinute(9.2)).toBeCloseTo(
      minuteNine + (minuteTen - minuteNine) * 0.2,
      6,
    );
  });

  it("projeta os quatro limites de ±0,3 minuto para todos os pontos", () => {
    chartData.points.forEach((point) => {
      const projection = projectChartTolerance(chartData.chart, point);
      expect(projection.tolerance.minutes).toBe(0.3);
      expect(projection.tolerance.polygon).toHaveLength(4);
      expect(
        projection.tolerance.polygon.every(
          (corner) =>
            corner.x >= 0 &&
            corner.x <= chartData.chart.width &&
            corner.y >= 0 &&
            corner.y <= chartData.chart.height,
        ),
      ).toBe(true);
    });
  });

  it("mantém o valor médio dentro da área semitransparente", () => {
    chartData.points.forEach((point) => {
      const { point: center, tolerance } = projectChartTolerance(
        chartData.chart,
        point,
      );
      expect(center.x).toBeGreaterThanOrEqual(tolerance.bounds.left);
      expect(center.x).toBeLessThanOrEqual(
        tolerance.bounds.left + tolerance.bounds.width,
      );
      expect(center.y).toBeGreaterThanOrEqual(tolerance.bounds.top);
      expect(center.y).toBeLessThanOrEqual(
        tolerance.bounds.top + tolerance.bounds.height,
      );
    });
  });

  it("liga a régua mais próxima ao valor médio de cada eixo", () => {
    chartData.points.forEach((point) => {
      const projection = projectChartTolerance(chartData.chart, point);
      [projection.longitude, projection.latitude].forEach((guide) => {
        expect(onBorder(guide.segment[0])).toBe(true);
        expect(guide.segment[1].x).toBeCloseTo(projection.point.x, 6);
        expect(guide.segment[1].y).toBeCloseTo(projection.point.y, 6);
      });
    });
  });

  it("rejeita tolerâncias inválidas", () => {
    expect(() =>
      projectChartTolerance(chartData.chart, chartData.points[0], 0),
    ).toThrow();
  });
});

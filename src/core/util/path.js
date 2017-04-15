/**
 * caculate the distance from a point to a segment.
 * @param {Point} p
 * @param {Point} p1
 * @param {Point} p2
 * @return {Number} distance from p to (p1, p2)
 * @memberOf Util
 */
export function distanceToSegment(p, p1, p2) {
    const x = p.x,
        y = p.y,
        x1 = p1.x,
        y1 = p1.y,
        x2 = p2.x,
        y2 = p2.y;

    const cross = (x2 - x1) * (x - x1) + (y2 - y1) * (y - y1);
    if (cross <= 0) {
        // P->P1
        return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
    }
    const d2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (cross >= d2) {
        // P->P2
        return Math.sqrt((x - x2) * (x - x2) + (y - y2) * (y - y2));
    }
    const r = cross / d2;
    const px = x1 + (x2 - x1) * r;
    const py = y1 + (y2 - y1) * r;
    // P->P(px,py)
    return Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
}

/**
 * Whether the coordinate is inside the polygon
 * @param {Polygon}         - polygon
 * @param {Coordinate}      - coordinate
 * @return {Boolean}
 * @memberOf Util
 */
export function pointInsidePolygon(p, points) {
    let p1, p2;
    const len = points.length;
    let c = false;

    for (let i = 0, j = len - 1; i < len; j = i++) {
        p1 = points[i];
        p2 = points[j];
        if (((p1.y > p.y) !== (p2.y > p.y)) &&
            (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
            c = !c;
        }
    }

    return c;
}

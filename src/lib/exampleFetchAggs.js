import { getH3AggCallable } from "./callables";

export async function exampleFetchAggs({ pollId, questionId, bounds, resolution }) {
  const finite =
    bounds &&
    [bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite) &&
    bounds.west < bounds.east &&
    bounds.south < bounds.north;

  const payload = finite
    ? {
        pollId,
        questionId,
        res: resolution,
        west: bounds.west,
        south: bounds.south,
        east: bounds.east,
        north: bounds.north,
      }
    : { pollId, questionId, res: resolution };

  const { data } = await getH3AggCallable(payload);
  return data?.aggs ? data.aggs : [];
}

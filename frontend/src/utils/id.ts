let idCounter = 0;

export const createId = (prefix = 'id') => {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;

  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
};

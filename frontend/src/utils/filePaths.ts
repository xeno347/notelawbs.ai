const FILE_SCHEME = 'file://';

const remoteSchemes = ['http://', 'https://', 'content://', 'data:', 'blob:', 'bundle-assets://', 'ms-appx:///'];

export const stripFileScheme = (path: string) => {
  if (path.startsWith(FILE_SCHEME)) {
    return path.slice(FILE_SCHEME.length);
  }

  return path;
};

export const toFilesystemPath = (path: string) => stripFileScheme(path);

export const toLocalFileUri = (path: string) => {
  if (remoteSchemes.some((scheme) => path.startsWith(scheme))) {
    return path;
  }

  const normalizedPath = stripFileScheme(path);
  return `${FILE_SCHEME}${normalizedPath}`;
};

export const getFileNameFromPath = (path: string) => {
  const normalizedPath = stripFileScheme(path);
  return normalizedPath.split('/').pop() || '';
};

import ReactNativeBlobUtil from 'react-native-blob-util';

const SETTINGS_DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/litnotes_data/`;
const SETTINGS_FILE = `${SETTINGS_DIR}app_settings.json`;

async function ensureStore() {
  const exists = await ReactNativeBlobUtil.fs.isDir(SETTINGS_DIR);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(SETTINGS_DIR);
  }
  const fileExists = await ReactNativeBlobUtil.fs.exists(SETTINGS_FILE);
  if (!fileExists) {
    await ReactNativeBlobUtil.fs.writeFile(SETTINGS_FILE, JSON.stringify({}), 'utf8');
  }
}

async function readAll(): Promise<Record<string, string>> {
  await ensureStore();
  try {
    const raw = await ReactNativeBlobUtil.fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw || '{}') as Record<string, string>;
  } catch (error) {
    return {};
  }
}

async function writeAll(value: Record<string, string>) {
  await ensureStore();
  await ReactNativeBlobUtil.fs.writeFile(SETTINGS_FILE, JSON.stringify(value, null, 2), 'utf8');
}

export const getAppSetting = async (key: string): Promise<string | null> => {
  const data = await readAll();
  return data[key] ?? null;
};

export const setAppSetting = async (key: string, value: string) => {
  const data = await readAll();
  data[key] = value;
  await writeAll(data);
};

export const removeAppSetting = async (key: string) => {
  const data = await readAll();
  delete data[key];
  await writeAll(data);
};

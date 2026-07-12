import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const RN = require('react-native');
  const identity = (value) => value;
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    Image: RN.Image,
    ScrollView: RN.ScrollView,
    createAnimatedComponent: (Component) => Component,
  };

  return {
    __esModule: true,
    default: Animated,
    View: RN.View,
    Text: RN.Text,
    Image: RN.Image,
    ScrollView: RN.ScrollView,
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (updater) => updater(),
    useAnimatedGestureHandler: () => identity,
    useDerivedValue: (updater) => ({ value: updater() }),
    withTiming: identity,
    runOnJS: (fn) => fn,
    Easing: {},
  };
});

jest.mock('@op-engineering/op-sqlite', () => ({
  open: () => ({
    execute: jest.fn(),
  }),
}));

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {
      DocumentDir: '/tmp',
    },
    isDir: jest.fn(async () => true),
    mkdir: jest.fn(async () => undefined),
    cp: jest.fn(async () => undefined),
    exists: jest.fn(async () => true),
  },
}));

jest.mock('react-native-document-picker', () => ({
  pickSingle: jest.fn(async () => {
    throw new Error('Document picking is unavailable in tests.');
  }),
  isCancel: jest.fn(() => false),
  types: {
    pdf: 'pdf',
    docx: 'docx',
  },
}));

jest.mock('react-native-share', () => ({
  open: jest.fn(async () => undefined),
}));

jest.mock('react-native-pdf', () => 'Pdf');

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({ children }) => React.createElement(React.Fragment, null, children),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useNavigationState: () => '',
    useRoute: () => ({ params: {} }),
  };
});

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }) => children,
    Screen: () => null,
  }),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const Icon = () => React.createElement(React.Fragment, null);
  return new Proxy(
    {},
    {
      get: () => Icon,
    },
  );
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const Comp = ({ children }) => React.createElement(React.Fragment, null, children);
  return {
    Svg: Comp,
    Circle: Comp,
    Defs: Comp,
    Line: Comp,
    LinearGradient: Comp,
    Rect: Comp,
    Stop: Comp,
  };
});

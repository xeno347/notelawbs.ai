import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { reportReactError } from '../services/errorReporting';

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null };

/** Catches render crashes so one pane failure does not blank the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportReactError(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>{this.props.fallbackTitle || 'Something went wrong'}</Text>
          <Text style={styles.body}>{this.state.error.message || 'Unexpected error'}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#F7F3EC',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1C1917', marginBottom: 8 },
  body: { fontSize: 13, color: '#78716C', textAlign: 'center', marginBottom: 16 },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#B45309',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

import { useRef, useEffect } from 'react';
import { StatusBar, BackHandler, SafeAreaView, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const PHONEDEV_URL = 'https://gravermistakes.github.io/agileagents/phonedev/';

export default function App() {
  const webviewRef = useRef(null);

  useEffect(() => {
    const onBack = () => {
      if (webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0e1219" />
      <WebView
        ref={webviewRef}
        source={{ uri: PHONEDEV_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        allowsBackForwardNavigationGestures
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith('intent:')) return false;
          return true;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1219' },
  webview: { flex: 1 },
});

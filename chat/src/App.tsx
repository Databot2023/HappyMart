// ─────────────────────────────────────────────────────────────────────────────
// src/App.tsx  –  Root component: screen router + toast overlay
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SplashScreen }         from './screens/SplashScreen';
import { OnboardingScreen }      from './screens/OnboardingScreen';
import { HomeScreen }            from './screens/HomeScreen';
import { ChatScreen }            from './screens/ChatScreen';
import { CallScreen }            from './screens/CallScreen';
import { AddFriendScreen }       from './screens/AddFriendScreen';
import { FriendRequestsScreen }  from './screens/FriendRequestsScreen';
import { SettingsScreen }        from './screens/SettingsScreen';

function Router() {
  const { state } = useApp();
  const { screen, toast } = state;

  return (
    <div className="app-root">
      {/* Screen */}
      {screen === 'splash'          && <SplashScreen />}
      {screen === 'onboarding'      && <OnboardingScreen />}
      {screen === 'home'            && <HomeScreen />}
      {screen === 'chat'            && <ChatScreen />}
      {screen === 'call'            && <CallScreen />}
      {screen === 'addFriend'       && <AddFriendScreen />}
      {screen === 'friendRequests'  && <FriendRequestsScreen />}
      {screen === 'settings'        && <SettingsScreen />}

      {/* Toast notification */}
      {toast && (
        <div className="toast" id="toast-msg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}

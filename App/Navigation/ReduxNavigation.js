import React from 'react'
import { AsyncStorage, BackHandler, NativeModules } from 'react-native'
import { addNavigationHelpers } from 'react-navigation'
import { createReduxBoundAddListener } from 'react-navigation-redux-helpers'
import { connect } from 'react-redux'
import AppNavigation from './AppNavigation'
import { Root } from "native-base";
import BackgroundFetch from "react-native-background-fetch";
import EngineActions, { EngineSelectors } from '../Redux/EngineRedux'
const common = require('./../common.js');
const utils = require('./../Engine/misc/utils.js')
const { firebaseInstance } = require('../Engine/firebaseWrapper.js');

class ReduxNavigation extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      fbListner: false
    }
    this.publicKey = undefined
    this.ref = undefined
    this.shutDownSignOut = false;
  }
  componentWillMount () {
    if (!utils.is_iOS()) {
      BackHandler.addEventListener('hardwareBackPress', () => {
        const { dispatch, nav } = this.props
        // change to whatever is your first screen, otherwise unpredictable results may occur
        if (nav.routes.length === 1 && (nav.routes[0].routeName === 'LaunchScreen')) {
          return false
        }
        // if (shouldCloseApp(nav)) return false
        dispatch({ type: 'Navigation/BACK' })
        return true
      })
    }
    // Configure it.
    BackgroundFetch.configure({
      minimumFetchInterval: 15, // <-- minutes (15 is minimum allowed)
      stopOnTerminate: false,   // <-- Android-only,
      startOnBoot: true         // <-- Android-only
    }, () => {
      console.log("[js] Received background-fetch event");
      // Required: Signal completion of your task to native code
      // If you fail to do this, the OS can terminate your app
      // or assign battery-blame for consuming too much background-time
      this.props.dispatch(EngineActions.backgroundRefresh())
      BackgroundFetch.finish(BackgroundFetch.FETCH_RESULT_NEW_DATA);
    }, (error) => {
      console.log("[js] RNBackgroundFetch failed to start");
    });

    // Optional: Query the authorization status.
    BackgroundFetch.status((status) => {
      switch(status) {
        case BackgroundFetch.STATUS_RESTRICTED:
          console.log("BackgroundFetch restricted");
          break;
        case BackgroundFetch.STATUS_DENIED:
          console.log("BackgroundFetch denied");
          break;
        case BackgroundFetch.STATUS_AVAILABLE:
          console.log("BackgroundFetch is enabled");
          break;
      }
    });
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.engineShutdown) {
      // #FearThis  - Changes can result in loss of time, efficiency, users &
      //              data.
      this.___finishLogOutSequence()
    } else if (this.publicKey && !this.ref) {
      // Set up a listener for an event from the database to handle us
      // loosing a lock on this session:
      const sessionPath = common.getDbSessionPath(this.publicKey)
      this.ref = firebaseInstance.getFirebaseRef(sessionPath);
      this.ref.on('child_changed', (childSnapshot, prevChildKey) => {
        this.shutDownSignOut = false
        const session = childSnapshot.val()
        if (session !== common.getSessionId()) {
          this.___startLogOutSequence()
        }
      });
    }
  }

  componentWillUnmount () {
    if (!utils.is_iOS()) {
      BackHandler.removeEventListener('hardwareBackPress')
    }
  }

  _authWork = async (userData) => {
    this.publicKey = userData['appPublicKey']
    this.props.dispatch(EngineActions.setPublicKey(this.publicKey))
    const ref = firebaseInstance.getFirebaseRef(common.getDbSessionPath(this.publicKey));
    await ref.once('value')
    .then((snapshot) => {
      if (!snapshot.exists() || snapshot.val() === 'none') {
        //signin screen
        ref.set(common.getSessionId());
        this._setupVars(userData, common.getSessionId())
      }
      else if (snapshot.exists() && (!common.DEV_TESTING || snapshot.val() === common.getSessionId())) {
        //authloading screen
        this._setupVars(userData, common.getSessionId())
      }
      else {
        this.props.dispatch(EngineActions.setSession(snapshot.val()))
        this.props.dispatch({ type: 'Navigation/NAVIGATE', routeName: 'Block' })
      }
    })
  }
  _setupVars = async (userData, session) => {
    this.props.dispatch(EngineActions.setSession(session))
    this.props.dispatch(EngineActions.setUserData(userData))
    const userProfile = JSON.parse(await AsyncStorage.getItem('userProfile'));
    if (userProfile) {
      this.props.dispatch(EngineActions.setUserProfile(userProfile))
    }
    const token = await AsyncStorage.getItem('token')
    // console.log("firebase token readback", token)
    const { publicKey } =  this.props
    const notificationPath = common.getDbNotificationPath(publicKey)
    firebaseInstance.setFirebaseData(notificationPath, {token})
    this.props.dispatch(EngineActions.setToken(token))
    this.props.dispatch({ type: 'Navigation/NAVIGATE', routeName: 'App' })
  }

////////////////////////////////////////////////////////////////////////////////
//  Begin #FearThis: - Changes can result in loss of time, efficiency, users, &
//                     data.
//
//  Logout/shutdown involves shutting down the engine and waiting for that to
//  complete before signing out of blockstack / other operations (otherwise the
//  iOS code will crash causing problems).
//
//  The logout sequence can be triggered by a database event indicating that
//  we've lost session lock or from a user clicking on the log out button. The
//  next step is to request the engine shutdown and then wait for the
//  'engineShutDown' to come through props or a time-out to occur. After this
//  has occured, we then do UI cleanup and clearing of user data / async storage
//  before signing out of blockstack.
//
////////////////////////////////////////////////////////////////////////////////

  ___startLogOutSequence = async () => {
    const method = 'ReduxNavigation::___startLogOutSequence'
    if (this.ref) {
      this.ref.off();
      this.ref = undefined;
    }
    this.props.dispatch(EngineActions.initShutdown())

    const TIMEOUT_BEFORE_SHUTDOWN_MS = 6 * 1000;
    try {
      await utils.resolveAfterMilliseconds(TIMEOUT_BEFORE_SHUTDOWN_MS)
    } catch (error) {
      console.log(`ERROR(${method}): error during wait for engine shutdown.\n${error}`)
    } finally {
      console.log(`INFO(${method}): timed out waiting for engine shutdown.`)

      // Only call ___finishLogOutSequence once (it may have been called before the
      // timer above resolves):
      if (!this.shutDownSignOut) {
        this.___finishLogOutSequence()
      }
    }
  }

  ___finishLogOutSequence = async () => {
    if (!this.shutDownSignOut) {
      this.shutDownSignOut = true;

      if (this.publicKey) {
        if (!common.DEV_TESTING) {
          firebaseInstance.setFirebaseData(common.getDbSessionPath(this.publicKey), common.NO_SESSION)
        }
        this.props.dispatch(EngineActions.clearUserData(this.publicKey));
      }

      await AsyncStorage.clear();
      const { token } = this.props
      AsyncStorage.setItem('token', token);

      const {BlockstackNativeModule} = NativeModules;
      await BlockstackNativeModule.signOut()
      this.publicKey = undefined

      this.props.dispatch({ type: 'Navigation/NAVIGATE', routeName: 'Auth' })
    }
  }

////////////////////////////////////////////////////////////////////////////////
//  End #FearThis
////////////////////////////////////////////////////////////////////////////////


  render () {
    return (
      <Root>
        <AppNavigation
          screenProps={{logout: () => this.___startLogOutSequence(), authWork: (userData) => this._authWork(userData)}}
          navigation={addNavigationHelpers({dispatch: this.props.dispatch, state: this.props.nav, addListener: createReduxBoundAddListener('root') })}
        />
      </Root>
    )
  }
}

const mapStateToProps = (state) => {
  return {
    nav: state.nav,
    publicKey: EngineSelectors.getPublicKey(state),
    engineShutdown: EngineSelectors.getEngineShutdown(state),
    token: EngineSelectors.getToken(state),
  }
}

export default connect(mapStateToProps)(ReduxNavigation)

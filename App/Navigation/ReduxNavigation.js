import React from 'react'
import { Linking, AsyncStorage, BackHandler, NativeModules, View, Text, Image, Platform, PushNotificationIOS, NetInfo } from 'react-native'
import { addNavigationHelpers } from 'react-navigation'
import { createReduxBoundAddListener } from 'react-navigation-redux-helpers'
import { connect } from 'react-redux'
import AppNavigation from './AppNavigation'
import { Root } from 'native-base'
import BackgroundFetch from 'react-native-background-fetch'
import EngineActions, { EngineSelectors } from '../Redux/EngineRedux'
import RNExitApp from 'react-native-exit-app'
import chatIcon from '../Images/blue512.png'
import AwesomeAlert from 'react-native-awesome-alerts'
import Spinner from 'react-native-loading-spinner-overlay'
import Toast from 'react-native-root-toast';

const common = require('./../common.js')
const utils = require('./../Engine/misc/utils.js')
const { firebaseInstance } = require('../Engine/firebaseWrapper.js')

class ReduxNavigation extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      fbListner: false,
      isConnected: true,
      visible: false
    }
    this.publicKey = undefined
    this.ref = undefined
    this.shutDownSignOut = false
    this.allowSpinnerTimeout = false
    this.spinnerTimerRunning = false
    this.terminateToast = false
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
      console.log('[js] Received background-fetch event')
      // Required: Signal completion of your task to native code
      // If you fail to do this, the OS can terminate your app
      // or assign battery-blame for consuming too much background-time
      this.props.dispatch(EngineActions.backgroundRefresh())
      BackgroundFetch.finish(BackgroundFetch.FETCH_RESULT_NEW_DATA)
      if (Platform.OS === 'ios') {
        let number = this.props.contactMgr.getAllUnread()
        if (number > 100) { number = 99 }
        PushNotificationIOS.setApplicationIconBadgeNumber(number)
      }
    }, (error) => {
      console.log('[js] RNBackgroundFetch failed to start')
    })

    // Optional: Query the authorization status.
    BackgroundFetch.status((status) => {
      switch (status) {
        case BackgroundFetch.STATUS_RESTRICTED:
          console.log('BackgroundFetch restricted')
          break
        case BackgroundFetch.STATUS_DENIED:
          console.log('BackgroundFetch denied')
          break
        case BackgroundFetch.STATUS_AVAILABLE:
          console.log('BackgroundFetch is enabled')
          break
      }
    })
  }

  componentDidMount () {
    NetInfo.isConnected.addEventListener('connectionChange', this.handleConnectivityChange)
  }

  handleConnectivityChange = isConnected => {
    this.setState({ isConnected })
  };

  componentWillReceiveProps = (nextProps) => {
    if (nextProps.engineShutdown) {
      // #FearThis  - Changes can result in loss of time, efficiency, users &
      //              data.
      this.___finishLogOutSequence()
    }
    // spinner
    if (this.allowSpinnerTimeout &&
        !this.spinnerTimerRunning &&
        nextProps.spinnerFlag) {
      this.spinnerTimerRunning = true
      console.log("SETTING TIMER")
      setTimeout(() => {
        console.log("TIMER HAPPENED")
        this.props.dispatch(EngineActions.setSpinnerData(false, ''))
        this.spinnerTimerRunning = false
      }, 7000);
    }
    // toast
    if (!this.terminateToast && nextProps.toastFlag) {
      this.terminateToast = true
      setTimeout(() => {
        this.terminateToast = false
        this.props.dispatch(EngineActions.setToastData(false, ''))
      }, 5000); // hide toast after 5s
    }
  }

  componentWillUnmount () {
    if (!utils.is_iOS()) {
      BackHandler.removeEventListener('hardwareBackPress')
    }
    NetInfo.isConnected.removeEventListener('connectionChange', this.handleConnectivityChange)
  }

  _authWork = async (userData) => {
    // This variable controls whether or not you are presented with a page
    // if another session ID is in the database. If you are developing and
    // constantly killing and restarting the App, it makes sense to set the
    // logic below so that this is true. For production, it should be false.
    //
    // When you change code pertaining to the session listener, you should
    // set this var to false and test by changing the session id in the database.
    //
    // const SKIP_SESSION_BLOCK_PAGE_FOR_DEV = (process.env.NODE_ENV !== 'production')
    // pbj disabling this due to app background crashing
    this.allowSpinnerTimeout = false    // Never stop the spinner on login
    const SKIP_SESSION_BLOCK_PAGE_FOR_DEV = true

    this.shutDownSignOut = false
    this.publicKey = userData['appPublicKey']
    this.props.dispatch(EngineActions.setPublicKey(this.publicKey))
    const ref = firebaseInstance.getFirebaseRef(common.getDbSessionPath(this.publicKey))

    console.log(`INFO(ReduxNavigation::_authWork): reading session.`)
    return ref.once('value')
    .then(snapshot => {
      console.log(`INFO(ReduxNavigation::_authWork): AFTER reading session.`)
      if (!snapshot.exists() || snapshot.val() === 'none') {
        // signin screen
        ref.set(common.getSessionId())
        this._setupVars(userData, common.getSessionId())
        this.___installSessionLossListener()
      } else if (snapshot.exists() && (snapshot.val() === common.getSessionId())) {
        // authloading screen
        this._setupVars(userData, common.getSessionId())
        this.___installSessionLossListener()
      } else {
        if (SKIP_SESSION_BLOCK_PAGE_FOR_DEV) {
          ref.set(common.getSessionId())
          this._setupVars(userData, common.getSessionId())
          this.___installSessionLossListener()
        } else {
          this.props.dispatch(EngineActions.setSession(snapshot.val()))
          this.props.dispatch({ type: 'Navigation/NAVIGATE', routeName: 'Block' })
        }
      }
    })
    .catch(error => {
      console.log(`ERROR(ReduxNavigation::_authWork): ${error}`)
    })
  }
  _setupVars = async (userData, session) => {
    this.props.dispatch(EngineActions.setSession(session))
    this.props.dispatch(EngineActions.setUserData(userData))
    const userProfile = JSON.parse(await AsyncStorage.getItem('userProfile'))
    if (userProfile) {
      this.props.dispatch(EngineActions.setUserProfile(userProfile))
    }
    const token = await AsyncStorage.getItem('token')
    // console.log("firebase token readback", token)
    const { publicKey } = this.props
    const notificationPath = common.getDbNotificationPath(publicKey)
    firebaseInstance.setFirebaseData(notificationPath, {token, enabled: true})
    this.props.dispatch(EngineActions.setToken(token))
    this.props.dispatch({ type: 'Navigation/NAVIGATE', routeName: 'App' })
    this.allowSpinnerTimeout = true    // Never stop the spinner on login
  }

/// /////////////////////////////////////////////////////////////////////////////
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
/// /////////////////////////////////////////////////////////////////////////////

  ___startLogOutSequence = async () => {
    this.allowSpinnerTimeout = false    // Never stop the spinner on logouts
    const method = 'ReduxNavigation::___startLogOutSequence'
    if (this.ref) {
      this.ref.off()
      this.ref = undefined
    }
    this.props.dispatch(EngineActions.initShutdown())

    const TIMEOUT_BEFORE_SHUTDOWN_MS = 6 * 1000
    try {
      await utils.resolveAfterMilliseconds(TIMEOUT_BEFORE_SHUTDOWN_MS)
    } catch (error) {
      console.log(`ERROR(${method}): error during wait for engine shutdown.\n${error}`)
    } finally {
      this.allowSpinnerTimeout = true    // Never stop the spinner on logouts
      // Only call ___finishLogOutSequence once (it may have been called before the
      // timer above resolves):
      if (!this.shutDownSignOut) {
        console.log(`INFO(${method}): timed out waiting for engine shutdown. Forcing shut down.`)
        this.___finishLogOutSequence()
      } else {
        console.log(`INFO(${method}): Engine shut down successfully before force shut down timer.`)
      }
    }
  }

  ___finishLogOutSequence = async () => {
    if (!this.shutDownSignOut) {
      this.shutDownSignOut = true

      if (this.publicKey) {
        firebaseInstance.setFirebaseData(common.getDbSessionPath(this.publicKey), common.NO_SESSION)
        this.props.dispatch(EngineActions.clearUserData(this.publicKey))
      }

      // unsubscribe from all channels
      for (let ch in this.props.channels) {
        const {id} = this.props.channels[ch]
        firebaseInstance.unsubscribeFromTopic(id)
      }

      await AsyncStorage.clear()
      const { token } = this.props
      AsyncStorage.setItem('token', token)

      const {BlockstackNativeModule} = NativeModules
      if (utils.is_iOS()) {
        await BlockstackNativeModule.signOut()
      } else if (utils.isAndroid()) {
        await BlockstackNativeModule.signUserOut()
      } else {
        // TODO: something on desktop / web / blockstack.js
      }
      this.publicKey = undefined

      // if (utils.is_iOS()) { this.props.dispatch({ type: 'Navigation/NAVIGATE', routeName: 'Auth' }) } else { RNExitApp.exitApp() }
      this.props.dispatch({ type: 'Navigation/NAVIGATE', routeName: 'Auth' })
    }
  }

  ___installSessionLossListener = () => {
    if (this.publicKey && !this.ref) {
      const sessionPath = common.getDbSessionPath(this.publicKey)
      this.ref = firebaseInstance.getFirebaseRef(sessionPath)

      this.ref.on('value', (childSnapshot) => {
        const session = childSnapshot.val()
        if (session !== common.getSessionId()) {
          this.___startLogOutSequence()
        }
      })
    }
  }

/// /////////////////////////////////////////////////////////////////////////////
//  End #FearThis
/// /////////////////////////////////////////////////////////////////////////////

  render () {
    if (this.props.engineFault) {
      // console.log("Engine Fault", this.props.engineFault, this.props.userData)
      return (
        <AwesomeAlert
          show={this.props.engineFault}
          showProgress={false}
          title='Stealthy Error'
          message='Engine in a bad state'
          closeOnTouchOutside={false}
          closeOnHardwareBackPress={false}
          showCancelButton
          showConfirmButton
          cancelText='Restart Engine'
          confirmText='Logout'
          cancelButtonColor='#34bbed'
          confirmButtonColor='#DD6B55'
          onCancelPressed={() => {
            this.props.dispatch(EngineActions.restartEngine(this.props.userData))
          }}
          onConfirmPressed={() => {
            this.___startLogOutSequence()
          }}
        />
      )
    }
    else if (!this.state.isConnected) {
      return (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}} >
          <Image
            style={{width: 150, height: 150}}
            source={chatIcon}
          />
          <Text style={{fontSize: 30, fontWeight: 'bold', marginTop: 40}}>
            No internet connection!
          </Text>
        </View>
      )
    }
    else {
      return (
        <Root>
          <Spinner visible={this.props.spinnerFlag} textContent={this.props.spinnerMessage} textStyle={{color: '#FFF'}} />
          <Toast
            visible={this.props.toastFlag}
            position={-50}
            shadow={false}
            animation={false}
            hideOnPress={true}
            backgroundColor='#49c649'
          >
            <Text style={{fontWeight: 'bold'}}>
              {this.props.toastMessage}
            </Text>
          </Toast>
          <AppNavigation
            screenProps={{logout: () => this.___startLogOutSequence(), authWork: (userData) => this._authWork(userData)}}
            navigation={addNavigationHelpers({dispatch: this.props.dispatch, state: this.props.nav, addListener: createReduxBoundAddListener('root')})}
          />
        </Root>
      )
    }
  }
}

const mapStateToProps = (state) => {
  return {
    nav: state.nav,
    spinnerFlag: EngineSelectors.getSpinnerFlag(state),
    spinnerMessage: EngineSelectors.getSpinnerMessage(state),
    toastFlag: EngineSelectors.getToastFlag(state),
    toastMessage: EngineSelectors.getToastMessage(state),
    contactMgr: EngineSelectors.getContactMgr(state),
    publicKey: EngineSelectors.getPublicKey(state),
    engineFault: EngineSelectors.getEngineFault(state),
    engineShutdown: EngineSelectors.getEngineShutdown(state),
    userData: EngineSelectors.getUserData(state),
    token: EngineSelectors.getToken(state),
    appVersion: EngineSelectors.getAppVersion(state),
    channels: EngineSelectors.getChannelsData(state)
  }
}

export default connect(mapStateToProps)(ReduxNavigation)

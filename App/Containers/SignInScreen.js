import React from 'react';
import {
  ActivityIndicator, 
  AsyncStorage,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  WebView,
  Linking,
  NativeModules,
  Platform,
} from 'react-native';
import { Icon, Button, Overlay, SocialIcon } from 'react-native-elements'
import { connect } from 'react-redux'
import EngineActions, { EngineSelectors } from '../Redux/EngineRedux'

const common = require('./../common.js');
const utils = require('./../Engine/misc/utils.js');
const { firebaseInstance } = require('../Engine/firebaseWrapper.js');

// import FAQ from '../Components/FAQ'

import laptop from '../Images/laptopChat.png';
import chatIcon from '../Images/blue512.png';
import chatV1 from '../Images/StealthyV1.png';
import flow from '../Images/rStealthyFlow.jpg';
import graphitePlugin from '../Images/plugin.jpg';

class SignInScreen extends React.Component {
  static navigationOptions = {
    header: null,
  };
  render() {
    const activityIndicator = (this.props.spinner) ? <ActivityIndicator size="large" color="#34bbed"/> : null
    const marginBottom = (this.props.spinner) ? 40 : 80
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{flexDirection: 'row', marginTop: 40}}>
          <SocialIcon
            style={{width: 45, height: 45}}
            type='twitter'
            onPress={() => Linking.openURL('https://twitter.com/stealthyim').catch(err => console.error('An error occurred', err))}
          />
          <SocialIcon
            style={{width: 45, height: 45}}
            type='medium'
            onPress={() => Linking.openURL('https://medium.com/@stealthyim').catch(err => console.error('An error occurred', err))}
          />
          <Button
            onPress={this._signInAsync}
            title="Blockstack Login"
            textStyle={{ fontSize: 18, fontWeight: "900", color: "#34bbed"}}
            icon={{name: 'input', color: "#34bbed"}}
            disabled={this.props.spinner}
            buttonStyle={{
              marginLeft: 20,
              width: 200,
              height: 50,
              backgroundColor: "white",
              borderColor: "#34bbed",
              borderWidth: 2,
              borderRadius: 5,
              marginTop: 5
            }}
          />
        </View>
        <View style={{flexDirection: 'row', marginTop: 120}}>
          <Image
            source={chatIcon}
            style={{width: 50, height: 50}}
          />
          <Text style={{ fontWeight: 'bold', fontSize: 36, marginLeft: 15, marginBottom: 80, marginTop: 5 }}>Hi Stealthy 👋</Text>
        </View>
        <Text style={{ fontWeight: 'bold', fontSize: 24, color: 'grey', marginBottom }}>dApp Communication Protocol</Text>
        {activityIndicator}
        <Button
          onPress={this._signInAsync}
          title="Create Account"
          textStyle={{ fontSize: 18, fontWeight: "900", color: "white"}}
          icon={{name: 'create', color: "white"}}
          disabled={this.props.spinner}
          buttonStyle={{
            backgroundColor: "#34bbed",
            width: 180,
            height: 50,
            borderColor: "transparent",
            borderWidth: 0,
            borderRadius: 5,
            marginTop: 25
          }}
        />
        <Button
          onPress={() => Linking.openURL('https://www.youtube.com/watch?v=V9-egxTCFFE').catch(err => console.error('An error occurred', err))}
          title="Watch Demo"
          disabled={this.props.spinner}
          textStyle={{ fontSize: 18, fontWeight: "900", color: "black"}}
          icon={{name: 'featured-video', color: "black"}}
          buttonStyle={{
            backgroundColor: "white",
            width: 180,
            height: 50,
            borderColor: "black",
            borderWidth: 2,
            borderRadius: 5,
            marginTop: 25
          }}
        />
      </ScrollView>
    );
  }
  // iOS specific (possibly works on web too)
  _getUserData = async () => {
    const {BlockstackNativeModule} = NativeModules;
    BlockstackNativeModule.getUserData((error, userData) => {
      if (error) {
        throw(`Failed to get user data.  ${error}`);
        this.props.setSignInPending(false)
      } else {
        BlockstackNativeModule.getPublicKeyFromPrivate(
          userData['privateKey'], async (error, publicKey) => {
            if (error) {
              throw(`Failed to get public key from private. ${error}`);
              this.props.setSignInPending(false)
            }
            else {
              userData['appPublicKey'] = publicKey;
              AsyncStorage.setItem('userData', JSON.stringify(userData));
              this.props.screenProps.authWork(userData)
            }
        });
      }
    });
    return;
  };
  _signInAsync = async () => {
    this.props.setSignInPending(true)
    const method = 'SignInScreen::_signInAsync'

    const {BlockstackNativeModule} = NativeModules;
    const baseUrl = "https://www.stealthy.im"

    if (utils.isAndroid()) {
      // Need to populate userData as follows:
      // {
      //   username: <...>,
      //   profileURL: <...>,   TODO: AC
      //   privateKey: <...>,
      //   appPublicKey: <...>,
      // }
      let userData = {}

      try {
        // androidUserData {
        //   decentralizedID: <...>
        //   appPrivateKey: <...>
        // }
        const androidUserData = await BlockstackNativeModule.signIn()
        userData.privateKey = androidUserData.appPrivateKey
        userData.username = androidUserData.username
      } catch (error) {
        this.props.setSignInPending(false)
        throw utils.fmtErrorStr('Failed to sign in to Blockstack.', method, error)
      }

      try {
        const publicKey = await BlockstackNativeModule.getPublicKeyFromPrivateKey(userData.privateKey)
        userData.appPublicKey = publicKey
      } catch (error) {
        this.props.setSignInPending(false)
        throw utils.fmtErrorStr('Failed to get public key.', method, error)
      }

      AsyncStorage.setItem('userData', JSON.stringify(userData));
      this.props.screenProps.authWork(userData)
    } else if (utils.is_iOS()) {
      await BlockstackNativeModule.signIn(`${baseUrl}/redirect.html`, baseUrl, null, (error, events) => {
        if (!error) {
          this._getUserData()
        }
        else {
          this.props.setSignInPending(false)
        }
      });
    }
  }
}

const styles = StyleSheet.create({
  text: { fontWeight: 'bold', fontSize: 20 },
  container: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
  },
});

const mapStateToProps = (state) => {
  return {
    spinner: EngineSelectors.getSignInPending(state),
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setSignInPending: (flag) => dispatch(EngineActions.setSignInPending(flag)),
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(SignInScreen)

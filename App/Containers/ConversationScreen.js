import React from 'react';
import { connect } from 'react-redux'
import { AsyncStorage, View, ListView, StyleSheet, TouchableOpacity, NativeModules } from 'react-native';
import TouchableRow from './contacts/Row';
// import Header from './contacts/Header';
import Footer from './contacts/Footer';
import SectionHeader from './contacts/SectionHeader';
import { SearchBar, Text } from 'react-native-elements'
import { Button, Container, Header, Content, List, ListItem, Left, Body, Right, Item, Icon, Input, Thumbnail, Title } from 'native-base';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firebase from 'react-native-firebase';
import EngineActions, { EngineSelectors } from '../Redux/EngineRedux'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 20,
  },
  separator: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#8E8E8E',
  },
});

class ConversationScreen extends React.Component {
  static navigationOptions = ({ navigation }) => {
    const params = navigation.state.params || {};
    return {
      headerLeft: <Text h4 style={{marginLeft: 20, fontWeight: 'bold'}}>Messages</Text>,
      headerBackTitle: 'Back',
      headerRight: (
        //params.sendMessage()
        <TouchableOpacity onPress={() => params.goToChatRoom.navigate('BlockContactSearch')} style={{marginRight: 10}}>
          <Ionicons name="ios-paper-plane-outline" size={30} color='#037aff'/>
        </TouchableOpacity>
      ),
    };
  };
  constructor(props) {
    super(props);
    this.ds = new ListView.DataSource({ rowHasChanged: (r1, r2) => r1 !== r2 });
    this.state = {
      basic: true,
      listViewData: [],
      loaded: false
    };
  }
  async componentWillMount() {
    const { userData, token } = this.props
    const publicKey = userData['appPublicKey']
    let npath = `/global/notifications/development/${publicKey}/`
    if (process.env.NODE_ENV === 'production') {
      npath = `/global/notifications/${publicKey}/`
    }
    firebase.database().ref(npath).set({
      token,
    })
    this.props.navigation.setParams({ goToChatRoom: this.props.navigation, sendMessage: this.sendTestMessageToFirebase });
  }
  componentWillReceiveProps(nextProps) {
    const { contactMgr, engineInit } = nextProps
    if (engineInit && contactMgr && contactMgr.getContactIds) {
      const listViewData = contactMgr.getAllContacts()
      this.setState({listViewData})
    }
  }
  contactSelected = (id) => {
    const { contactMgr } = this.props
    if (contactMgr) {
      const theNextActiveContactId = id;
      const theNextActiveContact = contactMgr.getContact(theNextActiveContactId);
      this.props.handleContactClick(theNextActiveContact);
    }
    this.props.navigation.navigate('ChatRoom')
  }
  deleteRow(secId, rowId, rowMap) {
    rowMap[`${secId}${rowId}`].props.closeRow();
    const newData = [...this.state.listViewData];
    newData.splice(rowId, 1);
    this.setState({ listViewData: newData });
  }
  render() {
    const ds = new ListView.DataSource({ rowHasChanged: (r1, r2) => r1 !== r2 });
    return (
      <Container style={{backgroundColor: 'white'}}>
        <Content>
          <List
            dataSource={this.ds.cloneWithRows(this.state.listViewData)}
            renderRow={item =>
              <ListItem style={{marginLeft: 5}} avatar onPress={this.contactSelected.bind(this, item.id)}>
                <Left>
                  <Thumbnail source={{ uri: item.image}} />
                </Left>
                <Body>
                  <Text>{item.title}</Text>
                  <Text note>{item.summary}</Text>
                </Body>
                <Right>
                  <Text note>12:00</Text>
                </Right>
              </ListItem>}
            renderLeftHiddenRow={data =>
              <Button full onPress={() => alert(data)}>
                <Icon active name="information-circle" />
              </Button>}
            renderRightHiddenRow={(data, secId, rowId, rowMap) =>
              <Button full danger onPress={_ => this.deleteRow(secId, rowId, rowMap)}>
                <Icon active name="trash" />
              </Button>}
            leftOpenValue={75}
            rightOpenValue={-75}
          />
        </Content>
      </Container>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    token: EngineSelectors.getToken(state),
    userData: EngineSelectors.getUserData(state),
    contactMgr: EngineSelectors.getContactMgr(state),
    engineInit: EngineSelectors.getEngineInit(state),
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    handleContactClick: (contact) => dispatch(EngineActions.setActiveContact(contact)),
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(ConversationScreen)

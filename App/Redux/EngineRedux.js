import { createReducer, createActions } from 'reduxsauce'
import Immutable from 'seamless-immutable'

/* ------------- Types and Action Creators ------------- */

const { Types, Creators } = createActions({
  setEngineFailure: null,
  setUserData:['userData'],
  setEngineInitial: ['engineInit'],
  setEngineContactMgr: ['contactMgr'],
  setEngineMessages: ['messages'],
  setActiveContact: ['activeContact'],
  setOutgoingMessage: ['outgoingMessage'],
  setUserProfile: ['userProfile'],
})

export const EngineTypes = Types
export default Creators

/* ------------- Initial State ------------- */

export const INITIAL_STATE = {
  fetching: null,
  error: null,
  userData: null,
  userProfile: null,
  engineInit: false,
  contactMgr: null,
  messages: null,
  activeContact: '',
  outgoingMessage: '',
}

/* ------------- Selectors ------------- */

export const EngineSelectors = {
  getUserProfile: state => state.engine.userProfile,
  getUserData: state => state.engine.userData,
  getActiveContact: state => state.engine.activeContact,
  getEngineInit: state => state.engine.engineInit,
  getContactMgr: state => state.engine.contactMgr,
  getMessages: state => state.engine.messages,
  getOutgoingMessage: state => state.engine.outgoingMessage,
}

/* ------------- Reducers ------------- */

// engine failed to start
export const setEngineFailure = state => {
  // state.merge({ fetching: false, error: true, engine: null })
  return {
    ...state,
    fetching: false,
    error: true,
    engine: null
  }
}


// engine intialized
export const setUserData = (state, { userData }) => {
  // return state.merge({ userData })
  return {
    ...state,
    userData
  }
}

export const setUserProfile = (state, { userProfile }) => {
  // return state.merge({ userProfile })
  return {
    ...state,
    userProfile
  }
}

// engine intialized
export const setEngineInitial = (state, { engineInit }) => {
  // return state.merge({ engineInit })
  return {
    ...state,
    engineInit
  }
}

// set contact manager
export const setEngineContactMgr = (state, { contactMgr }) => {
  // return state.merge({ contactMgr })
  return {
    ...state,
    contactMgr
  }
}

// set messages
export const setEngineMessages = (state, { messages }) => {
  // return state.merge({ messages })
  return {
    ...state,
    messages
  }
}

// set active contact
export const setActiveContact = (state, { activeContact }) => {
  // return state.merge({ activeContact })
  return {
    ...state,
    activeContact
  }
}

// set outgoing message
export const setOutgoingMessage = (state, { outgoingMessage }) => {
  // return state.merge({ outgoingMessage })
  return {
    ...state,
    outgoingMessage
  }
}

/* ------------- Hookup Reducers To Types ------------- */

export const reducer = createReducer(INITIAL_STATE, {
  [Types.SET_USER_DATA]: setUserData,
  [Types.SET_USER_PROFILE]: setUserProfile,
  [Types.SET_OUTGOING_MESSAGE]: setOutgoingMessage,
  [Types.SET_ACTIVE_CONTACT]: setActiveContact,
  [Types.SET_ENGINE_FAILURE]: setEngineFailure,
  [Types.SET_ENGINE_INITIAL]: setEngineInitial,
  [Types.SET_ENGINE_CONTACT_MGR]: setEngineContactMgr,
  [Types.SET_ENGINE_MESSAGES]: setEngineMessages,
})

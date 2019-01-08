const { EventEmitterAdapter } = require('./../platform/reactNative/eventEmitterAdapter.js')
const utils = require('./utils.js')
const { firebaseInstance } = require('./../firebaseWrapper.js')
const common = require('./../../common.js')

class Discovery extends EventEmitterAdapter {
  constructor (aUserId, aPublicKey, aPrivateKey) {
    if (!aUserId || !aPublicKey || !aPrivateKey) {
      throw ('ERROR(discovery.js): Unable to create object from provided arguments.')
    }

    super()

    this.myUserId = aUserId
    this.publicKey = aPublicKey
    this.privateKey = aPrivateKey
    this.development = (process.env.NODE_ENV === 'development')

    this.fbListenerFn = undefined
  }

  _getDiscoveryRootRef () {
    const discoveryPath = `${common.getDbDiscoveryPath(this.publicKey)}`
    return firebaseInstance.getFirebaseRef(discoveryPath)
  }

  stop () {
    if (this.fbListenerFn) {
      this._getDiscoveryRootRef().off('child_added', this.fbListenerFn)
    }

    this.fbListenerFn = undefined
  }

  async _handleInvitation (aPublicKey, aStringifiedCipherObj) {
    // console.log(`DEBUG(discovery.js::_handleInvitation) ${aPublicKey}`)
    try {
      const cipherObj = JSON.parse(aStringifiedCipherObj)
      const theirUserId = await utils.decrypt(this.privateKey, cipherObj, true)
      this.emit('new-invitation', aPublicKey, theirUserId)
    } catch (err) {
      console.log(`ERROR(discovery.js::_handleInvitation): ${err}`)
    }
  }

  async _handleInvitationFromSnapshot (snapshot) {
    // const publicKey = snapshot ? snapshot.key : ''
    // console.log(`DEBUG(discovery.js::_handleInvitationFromSnapshot): ${publicKey}`)
    if (snapshot && snapshot.val()) {
      this._handleInvitation(snapshot.key, snapshot.val())
    }
  }

  // Clears an invitation from this user (this.publicKey) to a remote
  // user (theirPublicKey).
  //
  // Used right now only with channels (for maintaining counts of users in room).
  //
  async clearSentInvitation (theirPublicKey) {
    if (!theirPublicKey) {
      console.log(`ERROR(discovery.js::inviteContact): theirPublicKey unspecified.`)
      return
    }

    try {
      const discoveryPath = `${common.getDbDiscoveryPath(theirPublicKey)}/${this.publicKey}`
      const discoveryRef = firebaseInstance.getFirebaseRef(discoveryPath)
      const result = await discoveryRef.remove()
    } catch (err) {
      console.log(`ERROR(discovery.js::inviteContact): ${err}`)
    }
  }

  // Clears an invitation to this user (this.publicKey) from a remote user
  // (theirPublicKey).
  async clearReceivedInvitation (theirPublicKey) {
    if (!theirPublicKey) {
      console.log(`ERROR(discovery.js::clearReceivedInvitation): theirPublicKey unspecified.`)
      return
    }

    try {
      const discoveryPath = `${common.getDbDiscoveryPath(this.publicKey)}/${theirPublicKey}`
      const discoveryRef = firebaseInstance.getFirebaseRef(discoveryPath)
      const result = await discoveryRef.remove()
    } catch (err) {
      console.log(`ERROR(discovery.js::clearReceivedInvitation): ${err}`)
    }
  }

  async clearDiscoveryDb () {
    try {
      const result = await this._getDiscoveryRootRef().remove()
    } catch (err) {
      console.log(`ERROR(discovery.js::clearDiscoveryDb): ${err}`)
    }
  }

  // This is a faster check for new invitations. It reads the entire discovery
  // collection and checks to see if we have contacts with the public keys in
  // the collection. If a new contact is found, we call the _handleInvitation
  // method.
  async checkInvitations (aContactMgr) {
    if (aContactMgr) {
      let snapshot
      try {
        snapshot = await this._getDiscoveryRootRef().once('value')
      } catch (err) {
        throw `ERROR(discovery.js::checkInvitations): failed to read discovery root ref.`
      }

      if (snapshot && snapshot.val()) {
        const invitationDict = snapshot.val()
        for (const publicKey in invitationDict) {
          if (!aContactMgr.getContactWithPublicKey()) {
            await this._handleInvitation(publicKey, invitationDict[publicKey])
          }
        }
      }
    }
  }

  monitorInvitations () {
    this.fbListenerFn = this._getDiscoveryRootRef().on(
      'child_added', (snapshot) => this._handleInvitationFromSnapshot(snapshot))
  }

  // Updates the shared discovery structure with an invite if needed.
  // Shared discovery structure:
  //   ud/<their pk>/discovery/<our pk>
  //                                   blob: <enc id>
  //
  //   - If key <our pk> exists, nothing to do / no work.
  //   - If the key doesn't exist, we haven't connected to this person before or
  //     they deleted our thread and we need to send again.
  //
  async inviteContact (theirPublicKey) {
    if (!theirPublicKey) {
      throw (`ERROR(discovery.js::inviteContact): theirPublicKey unspecified.`)
    }

    try {
      const discoveryPath = `${common.getDbDiscoveryPath(theirPublicKey)}/${this.publicKey}`
      const discoveryRef = firebaseInstance.getFirebaseRef(discoveryPath)

      // If there is no existing invitation, then invite the specified contact:
      const snapshot = await discoveryRef.once('value')
      if (!snapshot || !snapshot.val()) {
        const encUserId = await utils.encrypt(theirPublicKey, this.myUserId)
        const encUserIdStr = JSON.stringify(encUserId)
        const result = await discoveryRef.set(encUserIdStr)
      }
    } catch (err) {
      console.log(`ERROR(discovery.js::inviteContact): ${err}`)
    }
  }
}

module.exports = { Discovery }

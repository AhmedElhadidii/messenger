// ConversationManager:
//
// A conversation is between the client user and the other user(s). It consists
// of individual messages between the users. The datastructure looks like the
// picture below:
//
// conversations = {
//     <userId>: <Array of Bundles>,
//     'joe.id': [
//         {
//             userId: 'joe.id',
//             bundleName: '0.b',
//             modified: false,
//             messages: [
//                 <ChatMessage>, <ChatMessage>, ... <ChatMessage>
//             ],
//         }
//     ],
//     'xan.id': [
//         {
//             bundleName: '0.b',
//             modified: false,
//             messages: [
//                 <ChatMessage>, <ChatMessage>, ... <ChatMessage>
//             ],
//         },
//         {
//             bundleName: '1.b',
//             modified: false,
//             messages: [
//                 <ChatMessage>, <ChatMessage>, ... <ChatMessage>
//             ],
//         },
//         ...,
//         {
//             bundleName: 'n.b',
//             modified: true,
//             messages: [
//                 <ChatMessage>, <ChatMessage>, ... <ChatMessage>
//             ],
//         }
//     ]
// }
//

function _throwIfUndef (aVarName, aVar) {
  if (aVar === undefined) {
    throw `${aVarName} is undefined`
  }
}

// TODO: should constructor init to modified true or false?
class Bundle {
  constructor (aUserId, aBundleId) {
    _throwIfUndef('aUserId', aUserId)
    _throwIfUndef('aBundleId', aBundleId)

    this.userId = aUserId
    this.bundleId = aBundleId
    this.bundleFile = `${aBundleId}.b`
    this.modified = false
    this.messages = []
  }

  inflate (someBundleData) {
    const method = 'Bundle::inflate'
    if (!someBundleData ||
        !someBundleData.hasOwnProperty('userId') ||
        !someBundleData.hasOwnProperty('bundleId') ||
        !someBundleData.hasOwnProperty('bundleFile') ||
        !someBundleData.hasOwnProperty('messages')) {
      throw(`ERROR(${method}): someBundleData is missing expected properties.`)
    }

    this.userId = someBundleData.userId
    this.bundleId = someBundleData.bundleId
    this.bundleFile = someBundleData.bundleFile
    this.modified = false
    this.messages = (someBundleData.messages) ? someBundleData.messages : []
  }

  setModified (isModified = true) {
    this.modified = isModified
  }

  isModified () {
    return this.modified
  }

  addMessage (aChatMsg) {
    this.modified = true
    this.messages.push(aChatMsg)
  }

  hasMessage (aMsgId) {
    if (aMsgId) {
      const theMessages = this.getMessages([aMsgId])
      if (theMessages.length > 0) {
        if (theMessages[0].to !== theMessages[0].from) {
          return true  // Not sent to self (special case allows 2 messages in conv.)
        }
        return (theMessages.length > 1)
      }
    }
    return false
  }

  // Requires an array.
  getMessages (theMsgIds) {
    const theMessages = []
    if (theMsgIds) {
      for (const message of this.messages) {
        if (theMsgIds.includes(message.id)) {
          theMessages.push(message)
        }
      }
    }
    return theMessages
  }

  static getNextBundleId (theLastBundleId = undefined) {
    if (theLastBundleId) {
      return theLastBundleId + 1
    }
    return 0
  }

  static compareBundleFiles (bundleFileNameA, bundleFileNameB) {
    const numA = parseInt(bundleFileNameA.replace('.b', ''))
    const numB = parseInt(bundleFileNameB.replace('.b', ''))
    return numA - numB
  }

  static compareBundleFilesFB (bundleFileNameA, bundleFileNameB) {
    const numA = parseInt(bundleFileNameA.replace('_b', ''))
    const numB = parseInt(bundleFileNameB.replace('_b', ''))
    return numA - numB
  }

  static compareBundles (bundleA, bundleB) {
    return Bundle.compareBundleFiles(bundleA.bundleFile, bundleB.bundleFile)
  }

  static compareBundlesFB (bundleA, bundleB) {
    return Bundle.compareBundleFilesFB(bundleA.bundleFile, bundleB.bundleFile)
  }

  static MAX_MESSAGES = 100000;  // TODO: make this 1000 after testing.
}

class ConversationManager {
  constructor (logger, aUserId, anIdxIoInst) {
    this.logger = logger
    this.userId = aUserId
    this.conversations = {}
    this.idxIoInst = anIdxIoInst
  }

  // Returns a promise that resolves to the following object:
  //   {
  //     userId: <a user id>,
  //     bundleObj: <a bundle object or undefined>
  //     error: <an error message or undefined>
  //   }
  // The promise should never reject. Be sure to check the resolved object to
  // see if the bundleObj is undefined and if there is a valid error message.
  //
  _getContactBundle(aContactId) {
    const method = 'ConversationManager::_getContactBundle'

    const obj = {
      userId: aContactId,
      bundleObj: undefined,
      error: undefined
    }

    const isFirebase = this.idxIoInst.isFirebase()
    const extension = isFirebase ? '_b' : '.b'
    const indexFilePath = `${aContactId}/conversations/bundles`

    return new Promise((resolve, reject) => {
      this.idxIoInst.readLocalIndex(indexFilePath)
      .then((indexData) => {
        // Check for valid indexData:
        if (!indexData || !indexData.active) {
          obj.error = `WARNING(${method}): indexData or indexData.active undefined for ${aContactId}.`
          resolve(obj)
          return
        }

        // Examine the index for active files that are bundles:
        const fileNames = Object.keys(indexData.active)
        const bundleFiles = []
        for (const fileName of fileNames) {
          if (fileName.endsWith(extension)) {
            bundleFiles.push(fileName)
          }
        }
        if (bundleFiles.length <= 0) {
          obj.error = `WARNING(${method}): No bundle files found in indexData.active for ${aContactId}.`
          resolve(obj)
          return
        }

        // sort the bundle files to get the newest one:
        if (isFirebase) {
          bundleFiles.sort(Bundle.compareBundleFilesFB)
        } else {
          bundleFiles.sort(Bundle.compareBundleFiles)
        }
        const lastFile = bundleFiles[bundleFiles.length - 1]
        const bundleFilePath = `${indexFilePath}/${lastFile}`

        return this.idxIoInst.readLocalFile(bundleFilePath)
        .then((bundleData) => {
          const bundle = new Bundle(aContactId, -1)
          try {
            bundle.inflate(bundleData)
            obj.bundleObj = bundle
          } catch (error) {
            obj.error = error
          }
          resolve(obj)
          return
        })
        .catch((error) => {
          obj.error = error
          // Intentionally resolving, not rejecting.
          resolve(obj)
          return
        })
      })
      .catch((error) => {
        obj.error = error
        // Intentionally resolving, not rejecting.
        resolve(obj)
        return
      })
    })
  }

  async loadContactBundles (contactIdArr) {
    const method = 'ConversationManager::loadContactBundles'
    if (!contactIdArr) {
      throw (`ERROR(${method}): contactIdArr undefined.`)
    }

    const promises = []
    for (const contactId of contactIdArr) {
      // _getContactBundle should always resolve and never reject, but to ensure
      // we don't fail early in fetching a contact bundle in the promise.all, we
      // add the catch below.
      //
      // TODO: - Consider spacing these requests out at 4 / second to prevent
      //       overloading GAIA for folks with a lot of bundles.
      //       - Consider lazy loading instead.
      //       - Consider local storage, then gating GAIA requests.
      //
      const promise =
        this._getContactBundle(contactId)
        .catch((error) => {
          console.log(`S-ERROR(${method}): Problem getting contact bundle.\n${error}`)
        })

      promises.push(promise)
    }

    const isFirebase = this.idxIoInst.isFirebase()
    const bundleWrapperObjs = await Promise.all(promises)
    // If in the unlikely event that a bundleWrapperObj is undefined, indicate
    // that we need to post-process the bundles to create empty ones for some
    // contacts.
    let bundleWrapperFail = false

    for (const bundleWrapperObj of bundleWrapperObjs) {
      if (!bundleWrapperObj) {
        console.log(`S-ERROR(${method}): bundle wrapper undefined.`)
        bundleWrapperFail = true
        continue
      }

      if (!bundleWrapperObj.hasOwnProperty('bundleObj') || !bundleWrapperObj.bundleObj) {
        const errMsg = `S-ERROR(${method}): bundle object undefined.`
        if ((bundleWrapperObj.hasOwnProperty('error') && bundleWrapperObj.error)) {
          errMsg += `\n${bundleWrapperObj.error}`
        }
        console.log(errMsg)
        bundleWrapperFail = true
        continue
      }

      try {
        const contactId = bundleWrapperObj.userId
        if (!contactId) {
          throw `ERROR(${method}): contactId is undefined.`
        }

        if (!(contactId in this.conversations)) {
          this.conversations[contactId] = []
        }
        this.conversations[contactId].push(bundleWrapperObj.bundleObj)

        if (isFirebase) {
          this.conversations[contactId].sort(Bundle.compareBundlesFB)
        } else {
          this.conversations[contactId].sort(Bundle.compareBundles)
        }
      } catch (error) {
        console.log(`S-ERROR(${method}): error processing bundle wrapper.\n${error}`)
        bundleWrapperFail = true
        continue
      }
    }

    if (bundleWrapperFail) {
      for (const contactId of contactIdArr) {
        if (!(contactId in this.conversations)) {
          console.log(`WARNING(${method}): creating new conversation bundle for ${contactId}`)
          this.createConversation(contactId)
        }
      }
    }
  }

  // TODO:
  //   - safe encryption
  //   - device IO local write
  //   - make this a one time operation like storing contact manager and
  //     have it run until no fail or 3 attempts
  async storeContactBundles () {
    const method = `ConversationManager::storeContactBundles`

    const promises = []
    for (const contactId in this.conversations) {
      const bundlePath = `${contactId}/conversations/bundles`

      const bundles = this.conversations[contactId]
      for (const bundle of bundles) {
        if (!bundle.isModified()) {
          continue
        }

        const bundleFilePath = `${bundlePath}/${bundle.bundleFile}`
        bundle.setModified(false)
        const wrPromise =
          this.idxIoInst.writeLocalFile(bundleFilePath, bundle)
          .catch((error) => {
            console.log(`S-ERROR(${method}): Error writing contact bundle ${bundleFilePath}.\n${error}.`)
            // Write failed. Keep status of the bundle as modified to cause
            // another write. Do not reject so that await doesn't end early
            // on the promise all below.
            bundle.setModified(true)
          })

        promises.push(wrPromise)
      }
    }

    const promiseResults = await Promise.all(promises)
  }

  hasMessage (aChatMessage) {
    // TODO: exapand to more bundles intelligently
    const userId = this._getConversationId(aChatMessage)
    const bundle = this._getLastBundle(userId)

    if (bundle === undefined) {
      // Throw b/c assume we add bundle when we add contact. Plus, can't get
      // offline msgs if we haven't added contact.
      throw (`ERROR(ConversationManager::hasMessage): no conversation exists for ${userId}.`)
    }

    const msgId = aChatMessage.id
    if (bundle.hasMessage(msgId)) {
      // TODO: future - broader check, ie. could this bundle even include this msgId,
      //       or should we pull other bundles?

      return true
    }

    return false
  }

  addMessage (aChatMessage) {
    const userId = this._getConversationId(aChatMessage)
    let bundle = this._getLastBundle(userId)

    if (bundle === undefined) {
      throw (`ERROR(ConversationManager::addMessage): no conversation exists for ${userId}.`)
    }

    const msgId = aChatMessage.id
    if (bundle.hasMessage(msgId)) {
      // TODO: future - broader check, ie. could this bundle even include this msgId,
      //       or should we pull other bundles?

      return
    }

    if (bundle.messages.length >= Bundle.MAX_MESSAGES) {
      if (bundle.messages.length > Bundle.MAX_MESSAGES) {
        this.logger('ERROR(ConversationManager::addMessage): messages length exceeds Bundle.MAX_MESSAGES')
      }

      bundle = this._addNewBundle(userId)
    }

    bundle.addMessage(aChatMessage)
  }

  // Takes the provided chat message, searches for it in bundles (currently only
  // the last bundle), and if found, marks that bundle as modified so it gets written
  // in the next save operation.
  markConversationModified (aChatMessage) {
    if (aChatMessage) {
      const userId = this._getConversationId(aChatMessage)
      const bundle = this._getLastBundle(userId)

      if (bundle) {
        const msgId = aChatMessage.id
        if (bundle.hasMessage(msgId)) {
          bundle.setModified()
        }
      }
    }
  }

  // TODO: make this take additional args. and return a range. e.g.:
  //       - limit = 100 messages
  //       - newestMsgId = id of newest message to fetch
  //            TODO: would want to add _getIndexOfMessage(aMessageId) to Bundle
  //
  // getMessages(aUserId, newestMsgId=Date.now(), limit=Bundle.MAX_MESSAGES) {
  getMessages (aUserId) {
    if (!(aUserId in this.conversations)) {
      this.logger(`ERROR(ConversationManager::getMessages): Messages for ${aUserId} unavailable.`)
    }
    const bundle = this._getLastBundle(aUserId)
    return (bundle) ? bundle.messages : []
  }

  // TODO: so much
  //         - merge this into getMessages above with an empty list default
  //         - handle the range to get additional bundles.
  //         - etc.
  getSpecificMessages (aUserId, aMsgIdList) {
    if (!(aUserId in this.conversations)) {
      this.logger(`ERROR(ConversationManager::getSpecificMessages): Messages for ${aUserId} unavailable.`)
    }
    const bundle = this._getLastBundle(aUserId)
    if (bundle) {
      return bundle.getMessages(aMsgIdList)
    }
    return []
  }

  // A message is unsent if it is either unsent or unseen.
  //
  // TODO: what to do about multiple bundles?
  //       - Should we search them?
  //       - Should we keep an index of ones w/ unsent messages?
  //       - Is this even a consideration?
  getUnsentMessages (aUserId) {
    if (!(aUserId in this.conversations)) {
      this.logger(`ERROR(ConversationManager::getUnsentMessages): Messages for ${aUserId} unavailable.`)
    }

    const unsentMessages = []
    const bundle = this._getLastBundle(aUserId)
    if (bundle) {
      for (const chatMsg of bundle.messages) {
        if (chatMsg.sent || chatMsg.seen) {
          continue
        }
        unsentMessages.push(chatMsg)
      }
    }
    return unsentMessages
  }

  // messageIds: an array of message Ids to mark as sent.
  //
  setMessageSent (messageIds, aUserId) {
    // TODO:
    this.logger('ConversationManager::setMessageSent - noop')
  }

  createConversation (aUserId) {
    const bundle = this.addConversation(aUserId)
    this.conversations[aUserId].push(bundle)
  }

  addConversation (aUserId) {
    if (aUserId in this.conversations) {
      throw 'ERROR(ConversationManager::addConversation): a conversation already exists for user ${aUserId}.'
    }

    this.conversations[aUserId] = []
    const bundle = new Bundle(aUserId, Bundle.getNextBundleId())
    bundle.setModified()
    return bundle
  }

  removeConversation (aUserId) {
    if (aUserId in this.conversations) {
      delete this.conversations[aUserId]

      const isFirebase = this.idxIoInst.isFirebase()
      // const extension = isFirebase ? '_b' : '.b'
      const indexFilePath = `${aUserId}/conversations/bundles`
      return this.idxIoInst.deleteLocalDir(indexFilePath)
    }
  }

  _getLastBundle (aUserId) {
    if (aUserId in this.conversations) {
      const numBundles = this.conversations[aUserId].length
      const lastBundleIdx = numBundles - 1
      return this.conversations[aUserId][lastBundleIdx]
    }

    return undefined
  }

  _addNewBundle (aUserId, theLastBundleId) {
    const bundle = new Bundle(aUserId,
                              Bundle.getNextBundleId(theLastBundleId))
    bundle.setModified()
    this.conversations[aUserId].push(bundle)

    return bundle
  }

  _getConversationId (aChatMessage) {
    const outgoing = (aChatMessage.from === this.userId)
    const conversationId = (outgoing) ? aChatMessage.to : aChatMessage.from
    return conversationId
  }
}

module.exports = { ConversationManager }

const BaseIO = require('./baseIO.js');
const utils = require('./../misc/utils.js')
const { firebaseInstance } = require('./../firebaseWrapper.js')

const ROOT = '/global/gaia';
const APP_NAME = 'stealthy.im';

module.exports = class FirebaseIO extends BaseIO {
  constructor(logger, pathURL, logOutput = false) {
    super();
    this.logger = logger;
    this.logOutput = logOutput;
    this.pathURL = pathURL;
  }

  log(...args) {
    if (this.logOutput) {
      this.logger(...args);
    }
  }

  // Public:
  //
  writeLocalFile(localUser, fileName, data) {
    // Clone the data we're writing b/c Firebase seems to make it sealed/immutable
    // which breaks the engine on iOS/ReactNative. The coniditional assignment is
    // for those special moments where for some reason we write an undefined value.
    const dcData = (data) ? utils.deepCopyObj(data) : data;

    const filePath = `${this._getLocalApplicationPath(localUser)}/${fileName}`;
    return this._write(filePath, dcData);
  }

  readLocalFile(localUser, fileName) {
    const filePath = `${this._getLocalApplicationPath(localUser)}/${fileName}`;
    return this._read(filePath);
  }

  deleteLocalFile(localUser, fileName) {
    const filePath = `${this._getLocalApplicationPath(localUser)}/${fileName}`;
    return this._delete(filePath);
  }

  readRemoteFile(remoteUser, fileName) {
    const filePath = `${this._getRemoteApplicationPath(remoteUser)}/${fileName}`;
    return this._read(filePath);
  }

  // Private:
  //
  _getLocalApplicationPath(localUser, appName = APP_NAME) {
    return `${ROOT}/${localUser}/${this.pathURL}/${APP_NAME}`;
  }

  _getRemoteApplicationPath(remoteUser, appName = APP_NAME) {
    return `${ROOT}/${remoteUser}/${this.pathURL}/${APP_NAME}`;
  }

  _write(filePath, data) {
    const cleanPath = utils.cleanPathForFirebase(filePath);
    this.log(`Writing data to: ${cleanPath}`);
    try {
      // TODO: set returns a promise--need to make this await and _write async
      //       or use a .catch
      return this.firebaseInstance.getFirebaseRef(cleanPath).set(data)
    } catch (err) {
      let errMsg = `ERROR: firebaseIO::_write ${err}`;
      if (process.env.NODE_ENV === 'production') {
        this.logger(errMsg);
      } else {
        throw errMsg;
      }
    }
  }

  _read(filePath) {
    const cleanPath = utils.cleanPathForFirebase(filePath);
    const targetRef = this.firebaseInstance.getFirebaseRef(cleanPath);

    return targetRef.once('value')
    .then((snapshot) => {
      this.log(`Read data from: ${cleanPath}`);
      return snapshot.val();
    })
    .catch((error) => {
      this.logger(`Read failed from: ${cleanPath}`);
      return undefined;
    });
  }

  _delete(filePath) {
    const cleanPath = utils.cleanPathForFirebase(filePath);
    this.log(`Deleting ${cleanPath}`);
    return this.firebaseInstance.getFirebaseRef(cleanPath).remove();
  }
};

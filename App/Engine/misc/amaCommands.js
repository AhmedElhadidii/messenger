export default class AmaCommands {
  constructor(aUserId, amaId) {
    this.userId = aUserId
    this.amaId = amaId
  }

  static cmdToText(command, obj) {
    return `/${command} ${JSON.stringify(obj)}`
  }

  static amaCreate(aTitle) {
    const obj = {
      title: aTitle
    }

    return AmaCommands.cmdToText('amaCreate', obj)
  }

  // TODO: refactor command strings into an array / data structure for DRY and
  //       ability to modify cmd prefix etc.
  //
  static isAmaCommand(text) {
    return text && (
        text.includes('/amaCreate') ||
        text.includes('/questionCreate') ||
        text.includes('/questionDelete') ||
        text.includes('/questionUpvote') ||
        text.includes('/questionUnvote') ||
        text.includes('/answerCreate') ||
        text.includes('/answerEdit') ||
        text.includes('/answerDelete') ||
        text.includes('/userBlock') ||
        text.includes('/userUnblock') ||
        text.includes('/delegateAdd') ||
        text.includes('/delegateDelete')
      )
  }

  questionCreate(text) {
    const obj = {
      ama_id: this.amaId,
      text: text
    }

    return AmaCommands.cmdToText('questionCreate', obj)
  }

  questionDelete(aQuestionId) {
    const obj = {
      ama_id: this.amaId,
      question_id: aQuestionId
    }

    return AmaCommands.cmdToText('questionDelete', obj)
  }

  questionUpvote(aQuestionId) {
    const obj = {
      ama_id: this.amaId,
      question_id: aQuestionId
    }

    return AmaCommands.cmdToText('questionUpvote', obj)
  }

  questionUnvote(aQuestionId) {
    const obj = {
      ama_id: this.amaId,
      question_id: aQuestionId
    }

    return AmaCommands.cmdToText('questionUnvote', obj)
  }

  questionPin(aQuestionId) {
    const obj = {
      ama_id: this.amaId,
      question_id: aQuestionId
    }

    return AmaCommands.cmdToText('questionPin', obj)
  }

  questionUnpin(aQuestionId) {
    const obj = {
      ama_id: this.amaId,
      question_id: aQuestionId
    }

    return AmaCommands.cmdToText('questionUnpin', obj)
  }

  answerCreate(aQuestionId, text) {
    const obj = {
      ama_id: this.amaId,
      question_id: aQuestionId,
      text: text
    }

    return AmaCommands.cmdToText('answerCreate', obj)
  }

  answerDelete(anAnswerId) {
    const obj = {
      ama_id: this.amaId,
      answer_id: anAnswerId
    }

    return AmaCommands.cmdToText('answerDelete', obj)
  }

  userBlock(aUserId) {
    const obj = {
      user_id: aUserId
    }

    return AmaCommands.cmdToText('userBlock', obj)
  }

  delegateAdd(aUserId) {
    const obj = {
      ama_id: this.amaId,
      user_id: aUserId
    }

    return AmaCommands.cmdToText('delegateAdd', obj)
  }

  delegateDelete(aUserId) {
    const obj = {
      ama_id: this.amaId,
      user_id: aUserId
    }

    return AmaCommands.cmdToText('delegateDelete', obj)
  }

  // Stretch / Future:
  //////////////////////////////////////////////////////////////////////////////
  objectPin() {
    // TODO
  }

  answerEdit(answerId) {
    // TODO
  }

  userUnblock(aUserId) {
    // TODO
  }
}

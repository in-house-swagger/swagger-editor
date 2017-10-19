import React, { PropTypes } from "react"
import "whatwg-fetch"
import DropdownMenu from "./DropdownMenu"
import Popup from "./Popup"
import NotificationSystem from 'react-notification-system';

export default class SpecMgrMenu extends React.Component {
  constructor(props, context) {
    super(props, context)

    this.state = {
      curSpecMgr: "http://localhost:8081/v1",
      curUser: "loading...",
      curBranch: "loading...",
      curMessage: this.getCommitMessage(),

      userList: null,
      branchList: null,
      tagList: null,
      gitObjectList: null,

      selectedUser: null,
      selectedBranchSource: null,
      selectedBranchTarget: null,
      selectedGitObject: null,
      selectedTag: null,

      targetUser: null,
      targetEmail: null,
      targetMessage: null,
      targetBranch: null,
      targetTag: null,

      defaultUser: null,
      defaultMessage: null,
      isProcessing: false
    }

    this.handleChange = this.handleChange.bind(this)
    this.syncDefault()
    this.syncUserlist()
    this.syncGitObjectLists()
    this.restoreCurUser()
  }

  handleChange = (event) => {
    this.setState({[event.target.name]: event.target.value})
  }

  requestStart = () => {
    this.setState({["isProcessing"]: true})
  }
  requestEnd = () => {
    this.setState({["isProcessing"]: false})
  }
  isRequestProcessing = () => {
    return this.state.isProcessing
  }


  syncDefault = () => {
    let errorTitle = "failed to get Default User"
    let url = this.state.curSpecMgr + "/env"
    fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(res => {
      res.json().then(json => {
        this.state.defaultUser = json.systemEnvironment.SCM_DEFAULT_USER
        this.state.defaultMessage = json.systemEnvironment.SCM_DEFAULT_COMMIT_MESSAGE
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  syncUserlist = () => {
    let errorTitle = "failed to get User list"
    let url = this.state.curSpecMgr + "/users"
    let headers = this.getRequestHeaders(null)
    fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(res => {
      res.json().then(json => {
        this.setState({["userList"]: json.payload.idList})
        // 一覧に現在ユーザが存在しない場合、デフォルトユーザを設定
        if (this.state.userList.indexOf(this.state.curUser) < 0) this.applyDefaultUser()
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  syncGitObjectLists = () => {
    let errorTitle = "failed to get Branch list"
    let url = this.state.curSpecMgr + "/branches"
    let headers = this.getRequestHeaders(null)
    fetch(url, {
      method: 'GET',
      headers: headers
    }).then(res => {
      res.json().then(json => {
        if (this.state.curBranch != json.payload.current) {
          this.setState({["curBranch"]: json.payload.current})
          // ブランチが切り替わった場合、編集中のspecをクリア
          this.props.updateState({["curSpecId"]: null})
        }
        this.setState({["branchList"]: json.payload.idList})
        // 続いけてtag一覧を更新
        this.syncTaglist()
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  syncTaglist = () => {
    let errorTitle = "failed to get Tag list"
    let url = this.state.curSpecMgr + "/tags"
    let headers = this.getRequestHeaders(null)
    fetch(url, {
      method: 'GET',
      headers: headers
    }).then(res => {
      res.json().then(json => {
        this.setState({["tagList"]: json.payload.idList})

        let tmpList = []
        tmpList = tmpList.concat(this.state.branchList)
        tmpList = tmpList.concat(this.state.tagList)
        this.setState({["gitObjectList"]: tmpList})
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }


  //================================================================================================
  // user
  //================================================================================================
  userManagementKey = () => {
    return "swagger-spec-mgr-user";
  }

  canUseUserManagement = () => {
    if(!window.localStorage) {
      noticeError('this browser is not support user-management.')
      this.state.curUser = "DEFAULT"
      return false
    }
    return true
  }

  applyDefaultUser = () => {
    this.saveCurUser(this.state.defaultUser)
  }

  saveCurUser = (id) => {
    if (! this.canUseUserManagement()) return

    let data = { id: id }
    window.localStorage.setItem(this.userManagementKey(), JSON.stringify(data))

    // ユーザ切替時
    if (this.state.curUser && this.state.curUser != id) {
      this.syncGitObjectLists()
    }
    // construct時はsetStateが利用できないので、直接stateプロパティを更新
    this.state.curUser = id
    this.setState({["curUser"]: id})
  }

  getCurUser = () => {
    if (! this.canUseUserManagement()) return

    let text = window.localStorage.getItem(this.userManagementKey());
    if (!text || text == "") { return { id: null} }
    return JSON.parse(text)
  }

  restoreCurUser = () => {
    if (! this.canUseUserManagement()) return

    let curUser = this.getCurUser()
    if (!curUser.id || curUser.id == "") {
      this.applyDefaultUser()
      return
    }
    this.saveCurUser(curUser.id)
  }

  deleteCurUser = () => {
    if (! this.canUseUserManagement()) return

    window.localStorage.removeItem(this.userManagementKey())
    this.setState({["curUser"]: null})
  }


  getRequestHeaders = (mimeType) => {
    let user = this.getCurUser()
    if (!mimeType) mimeType = "application/json"
    let data = {
      'Accept': mimeType,
      'Content-Type': mimeType,
      'X-Commit-User': window.encodeURIComponent(user.id),
      'X-Commit-Message': window.encodeURIComponent(this.state.curMessage)
    }
    return data
  }

  //------------------------------------------------------------------------------------------------
  // add user
  //------------------------------------------------------------------------------------------------
  showAddUserModal = () => {
    this.state.targetUser = null
    this.state.targetEmail = null
    this.refs.addUserModal.show()
  }
  hideAddUserModal = () => { this.refs.addUserModal.hide() }

  addUser = () => {
    let id = this.state.targetUser
    let email = this.state.targetEmail
    if (!id) {
      this.noticeError('id is Empty.')
      return
    }

    if (!email) {
      this.noticeError('email is Empty.')
      return
    }

    let errorTitle = "failed to create User"
    let url = this.state.curSpecMgr + "/users/" + id + "?email=" + email
    this.requestStart()
    fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, id, text)
          return
        }
        this.noticeSuccess(id + " User has been created.")
        this.requestEnd()
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideAddUserModal()
  }

  //------------------------------------------------------------------------------------------------
  // delete user
  //------------------------------------------------------------------------------------------------
  showDeleteUserModal = () => {
    this.syncUserlist()
    this.state.selectedUser = null
    this.refs.deleteUserModal.show()
  }
  hideDeleteUserModal = () => { this.refs.deleteUserModal.hide() }

  deleteUser = () => {
    let id = this.state.selectedUser
    if (!id) {
      this.noticeError('User is not Selected.')
      return
    }

    let errorTitle = "failed to delete User"
    let url = this.state.curSpecMgr + "/users/" + id
    this.requestStart()
    fetch(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, to, text)
          return
        }

        if (id == this.state.curUser) {
          this.syncGitObjectLists()
          this.applyDefaultUser()
        }
        this.noticeSuccess(id + " User has been deleted.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideDeleteUserModal()
  }

  //------------------------------------------------------------------------------------------------
  // change user
  //------------------------------------------------------------------------------------------------
  showChangeUserModal = () => {
    this.syncUserlist()
    this.state.selectedUser = null
    this.refs.changeUserModal.show()
  }
  hideChangeUserModal = () => { this.refs.changeUserModal.hide() }

  changeUser = () => {
    let id = this.state.selectedUser
    if (!id) {
      this.noticeError('User is not Selected.')
      return
    }

    if (id != this.state.curUser) {
      this.saveCurUser(id)
    }

    this.hideChangeUserModal()
  }


  //================================================================================================
  // commit message
  //================================================================================================
  getCommitMessageKey = () => {
    return "swagger-spec-mgr-message"
  }
  getCommitMessage = () => {
    return window.localStorage.getItem(this.getCommitMessageKey())
  }
  saveCommitMessage = () => {
    if (this.state.targetMessage) {
      window.localStorage.setItem(this.getCommitMessageKey(), this.state.targetMessage)
      this.state.curMessage = this.state.targetMessage
    }
    this.hideChangeCommitMessageModal()
  }

  //------------------------------------------------------------------------------------------------
  // change message
  //------------------------------------------------------------------------------------------------
  showChangeCommitMessageModal = () => {
    if (this.state.curMessage) this.state.curMessage = this.state.defaultMessage
    this.state.targetMessage = null
    this.refs.changeCommitMessageModal.show()
  }
  hideChangeCommitMessageModal = () => {
    this.refs.changeCommitMessageModal.hide()
  }


  //================================================================================================
  // branch
  //================================================================================================
  //------------------------------------------------------------------------------------------------
  // add branch
  //------------------------------------------------------------------------------------------------
  showAddBranchModal = () => {
    this.syncGitObjectLists()
    this.state.selectedGitObject = null
    this.state.targetBranch = null
    this.refs.addBranchModal.show()
  }
  hideAddBranchModal = () => { this.refs.addBranchModal.hide() }

  addBranch = () => {
    let from = this.state.selectedGitObject
    if (!from) {
      this.noticeError("From GitObject is Empty")
      return
    }
    let to = this.state.targetBranch
    if (!to) {
      this.noticeError("Branch Name is Empty")
      return
    }

    let errorTitle = "failed to create Branch"
    let url = this.state.curSpecMgr + "/branches/" + to + "?object=" + from
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'POST',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, to, text)
          return
        }

        this.syncGitObjectLists()
        this.hideAddBranchModal()

        this.noticeSuccess(to + " Branch has been created.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  //------------------------------------------------------------------------------------------------
  // rename branch
  //------------------------------------------------------------------------------------------------
  showRenameBranchModal = () => {
    this.syncGitObjectLists()
    this.state.selectedBranchTarget = null
    this.state.targetBranch = null
    this.refs.renameBranchModal.show()
  }
  hideRenameBranchModal = () => { this.refs.renameBranchModal.hide() }

  renameBranch = () => {
    let from = this.state.selectedBranchTarget
    if (!from) {
      this.noticeError("From Branch is not selected")
      return
    }
    let to = this.state.targetBranch
    if (!to) {
      this.noticeError("Branch Name is Empty")
      return
    }

    let errorTitle = "failed to rename Branch"
    let url = this.state.curSpecMgr + "/branches/" + from + "?to=" + to
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'PUT',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, to, text)
          return
        }

        this.syncGitObjectLists()
        this.hideRenameBranchModal()

        this.noticeSuccess(to + " Branch has been renamed.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  //------------------------------------------------------------------------------------------------
  // delete branch
  //------------------------------------------------------------------------------------------------
  showDeleteBranchModal = () => {
    this.syncGitObjectLists()
    this.state.selectedBranchTarget = null
    this.refs.deleteBranchModal.show()
  }
  hideDeleteBranchModal = () => { this.refs.deleteBranchModal.hide() }

  deleteBranch = () => {
    let targetBranch = this.state.selectedBranchTarget
    if(!targetBranch) {
      this.noticeError("Branch is not selected")
      return
    }

    let errorTitle = "failed to delete Branch"
    let url = this.state.curSpecMgr + "/branches/" + targetBranch
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'DELETE',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetBranch, text)
          return
        }

        if (this.state.curBranch == targetBranch) {
          this.syncGitObjectLists()
        }
        this.noticeSuccess(targetBranch + " Branch has been deleted.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideDeleteBranchModal()
  }

  //------------------------------------------------------------------------------------------------
  // switch
  //------------------------------------------------------------------------------------------------
  showSwitchModal = () => {
    this.syncGitObjectLists()
    this.state.selectedBranchTarget = null
    this.refs.switchModal.show()
  }
  hideSwitchModal = () => { this.refs.switchModal.hide() }

  switchBranch = () => {
    let targetBranch = this.state.selectedBranchTarget
    if(!targetBranch) {
      this.noticeError("Branch is not selected")
      return
    }

    let errorTitle = "failed to switch Branch"
    let url = this.state.curSpecMgr + "/switch/" + targetBranch
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'POST',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetBranch, text)
          return
        }

        // propsに設定された、親のstate更新メソッドで、curSpecIdのクリアを通知
        this.syncGitObjectLists()
        this.hideSwitchModal()
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  //------------------------------------------------------------------------------------------------
  // merge
  //------------------------------------------------------------------------------------------------
  showMergeModal = () => {
    this.syncGitObjectLists()
    this.state.selectedBranchSource = null
    this.state.selectedBranchTarget = null
    this.refs.mergeModal.show()
  }
  hideMergeModal = () => { this.refs.mergeModal.hide() }

  merge = () => {
    let from = this.state.selectedBranchSource
    if (!from) {
      this.noticeError("From Branch is not selected")
      return
    }
    let to = this.state.selectedBranchTarget
    if (!to) {
      this.noticeError("To Branch is not selected")
      return
    }

    let errorTitle = "failed to merge"
    let url = this.state.curSpecMgr + "/merges?source=" + from + "&target=" + to
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'POST',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, to, text)
          return
        }

        this.syncGitObjectLists()
        this.hideMergeModal()

        this.noticeSuccess(from + " has been merge into " + to + ".")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }


  //================================================================================================
  // tag
  //================================================================================================
  //------------------------------------------------------------------------------------------------
  // add tag
  //------------------------------------------------------------------------------------------------
  showAddTagModal = () => {
    this.syncGitObjectLists()
    this.state.selectedGitObject = null
    this.state.targetTag= null
    this.refs.addTagModal.show()
  }
  hideAddTagModal = () => { this.refs.addTagModal.hide() }

  addTag = () => {
    let from = this.state.selectedGitObject
    if (!from) {
      this.noticeError("From GitObject is Empty")
      return
    }
    let to = this.state.targetTag
    if (!to) {
      this.noticeError("Tag Name is Empty")
      return
    }

    let errorTitle = "failed to create Tag"
    let url = this.state.curSpecMgr + "/tags/" + to + "?object=" + from
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'POST',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, to, text)
          return
        }
        this.noticeSuccess(to + " Tag has been created.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideAddTagModal()
  }

  //------------------------------------------------------------------------------------------------
  // rename tag
  //------------------------------------------------------------------------------------------------
  showRenameTagModal = () => {
    this.syncTaglist()
    this.state.selectedTag = null
    this.state.targetTag = null
    this.refs.renameTagModal.show()
  }
  hideRenameTagModal = () => { this.refs.renameTagModal.hide() }

  renameTag = () => {
    let from = this.state.selectedTag
    if (!from) {
      this.noticeError("From Tag is not selected")
      return
    }
    let to = this.state.targetTag
    if (!to) {
      this.noticeError("Tag Name is Empty")
      return
    }

    let errorTitle = "failed to rename Tag"
    let url = this.state.curSpecMgr + "/tags/" + from + "?to=" + to
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'PUT',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, to, text)
          return
        }
        this.noticeSuccess(to + " Tag has been renamed.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideRenameTagModal()
  }

  //------------------------------------------------------------------------------------------------
  // delete tag
  //------------------------------------------------------------------------------------------------
  showDeleteTagModal = () => {
    this.syncTaglist()
    this.state.selectedTag = null
    this.refs.deleteTagModal.show()
  }
  hideDeleteTagModal = () => { this.refs.deleteTagModal.hide() }

  deleteTag = () => {
    let targetTag = this.state.selectedTag
    if(!targetTag) {
      this.noticeError("Tag is not selected")
      return
    }

    let errorTitle = "failed to delete Tag"
    let url = this.state.curSpecMgr + "/tags/" + targetTag
    let headers = this.getRequestHeaders(null)
    this.requestStart()
    fetch(url, {
      method: 'DELETE',
      headers: headers
    }).then(res => {
      this.requestEnd()
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetTag, text)
          return
        }
        this.noticeSuccess(targetTag + " Tag has been deleted.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideDeleteTagModal()
  }


  //------------------------------------------------------------------------------------------------
  // notification
  //------------------------------------------------------------------------------------------------
  handleSpecMgrError = (errorTitle, id, text) => {
    let json = JSON.parse(text)
    if (json) {
      this.noticeListError(errorTitle + ": " + id, json._errors.list)
    } else {
      this.noticeError(errorTitle + ": " + id, text)
    }
  }
  noticeListError = (title, errorList) => {
    for (let i = 0; i < errorList.length; i++) {
      let key = errorList[i].propertyKey
      let message = errorList[i].message
      this.noticeError(title, message)
    }
  }
  noticeSuccess = (title) => this.notice("success", title, null, 3)
  noticeError = (title, message) => this.notice("error", title, message, 0)
  notice = (level, title, message, autoDismiss) => {
    // level: success, error, warning, info
    this.refs.notificationSystem.addNotification({
      level: level,
      title: title,
      message: message,
      autoDismiss: autoDismiss,
      position: 'bl'
    });
  }


  render() {
    let makeMenuOptions = (name) => {
      let stateKey = `is${name}MenuOpen`
      let toggleFn = () => this.setState({ [stateKey]: !this.state[stateKey] })
      return {
        isOpen: !!this.state[stateKey],
        close: () => this.setState({ [stateKey]: false }),
        align: "left",
        toggle: <span className="menu-item" onClick={toggleFn}>{ name }</span>
      }
    }

    return (
      <div className="topbar-specmgr-info">
        <span className="item item-title">SpecID : {this.props.children}</span>

        <DropdownMenu className="item" {...makeMenuOptions("Branch : " + this.state.curBranch)}>
          <li><button type="button" onClick={this.showAddBranchModal}>Add Branch</button></li>
          <li><button type="button" onClick={this.showRenameBranchModal}>Rename Branch</button></li>
          <li><button type="button" onClick={this.showDeleteBranchModal}>Delete Branch</button></li>
          <li role="separator"></li>
          <li><button type="button" onClick={this.showSwitchModal}>Switch Branch</button></li>
          <li role="separator"></li>
          <li><button type="button" onClick={this.showMergeModal}>Merge Branch</button></li>
        </DropdownMenu>

        <DropdownMenu className="item" {...makeMenuOptions("Tag")}>
          <li><button type="button" onClick={this.showAddTagModal}>Add Tag</button></li>
          <li><button type="button" onClick={this.showRenameTagModal}>Rename Tag</button></li>
          <li><button type="button" onClick={this.showDeleteTagModal}>Delete Tag</button></li>
        </DropdownMenu>

        <DropdownMenu className="item" {...makeMenuOptions("User : " + this.state.curUser)}>
          <li><button type="button" onClick={this.showAddUserModal}>Add User</button></li>
          <li><button type="button" onClick={this.showDeleteUserModal}>Delete User</button></li>
          <li><button type="button" onClick={this.showChangeUserModal}>Change User</button></li>
          <li role="separator"></li>
          <li><button type="button" onClick={this.showChangeCommitMessageModal}>Commit Msg</button></li>
        </DropdownMenu>


        <Popup title="Add User" ref="addUserModal">
          <div className="parameters-col_description">
            <p>Enter the User Infomation to create.</p>
            <div className="topbar-popup-item">
              <label>id:</label>
              <section>
                <input type="text" name="targetUser" onChange={this.handleChange}/>
              </section>
            </div>
            <div className="topbar-popup-item">
              <label>email:</label>
              <section>
                <input type="text" name="targetEmail" onChange={this.handleChange}/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.addUser}>Create</button>
          </div>
        </Popup>

        <Popup title="Delete User" ref="deleteUserModal">
          <div className="parameters-col_description">
            <p>Select the User to delete.</p>
            <div className="topbar-popup-item">
              <label>User:</label>
              <section>
                <select name="selectedUser" onChange={this.handleChange}>
                  <option key="null" value="null">-- User --</option>
                  { this.state.userList && this.state.userList.map(user => <option key={user} value={user}>{user}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.deleteUser}>Delete</button>
          </div>
        </Popup>

        <Popup title="Change User" ref="changeUserModal">
          <div className="parameters-col_description">
            <p>Select the Branch to open.</p>
            <div className="topbar-popup-item">
              <label>User:</label>
              <section>
                <select name="selectedUser" onChange={this.handleChange}>
                  <option key="null" value="null">-- User --</option>
                  { this.state.userList && this.state.userList.map(user => <option key={user} value={user}>{user}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.changeUser}>Change</button>
          </div>
        </Popup>


        <Popup title="Change Commit Message" ref="changeCommitMessageModal">
          <div className="parameters-col_description">
            <p>Enter the Commit Message to Save Specification.</p>
            <div className="topbar-popup-item">
              <label>message:</label>
              <section>
                <input type="text" name="targetMessage" onChange={this.handleChange} placeholder={this.state.curMessage} />
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.saveCommitMessage}>Save</button>
          </div>
        </Popup>


        <Popup title="Add Branch" ref="addBranchModal">
          <div className="parameters-col_description">
            <p>Enter the Branch Infomation to create.</p>
            <div className="topbar-popup-item">
              <label>From GitObject (Branch or Tag):</label>
              <section>
                <select name="selectedGitObject" onChange={this.handleChange}>
                  <option key="null" value="null">-- GitObject --</option>
                  { this.state.gitObjectList && this.state.gitObjectList.map(gitObject => <option key={gitObject} value={gitObject}>{gitObject}</option>) }
                </select>
              </section>
            </div>
            <div className="topbar-popup-item">
              <label>Add Branch Name:</label>
              <section>
                <input type="text" name="targetBranch" onChange={this.handleChange}/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.addBranch}>Create</button>
          </div>
        </Popup>

        <Popup title="Rename Branch" ref="renameBranchModal">
          <div className="parameters-col_description">
          <p>Enter the Branch Infomation to rename.</p>
            <div className="topbar-popup-item">
              <label>From Branch:</label>
              <section>
                <select name="selectedBranchTarget" onChange={this.handleChange}>
                  <option key="null" value="null">-- Branch --</option>
                  { this.state.branchList && this.state.branchList.map(branch => <option key={branch} value={branch}>{branch}</option>) }
                </select>
              </section>
            </div>
            <div className="topbar-popup-item">
              <label>To Branch Name:</label>
              <section>
                <input type="text" name="targetBranch" onChange={this.handleChange}/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.renameBranch}>Rename</button>
          </div>
        </Popup>

        <Popup title="Delete Branch" ref="deleteBranchModal">
          <div className="parameters-col_description">
            <p>Select the Branch to delete.</p>
            <div className="topbar-popup-item">
              <label>Branch:</label>
              <section>
                <select name="selectedBranchTarget" onChange={this.handleChange}>
                  <option key="null" value="null">-- Branch --</option>
                  { this.state.branchList && this.state.branchList.map(branch => <option key={branch} value={branch}>{branch}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.deleteBranch}>Delete</button>
          </div>
        </Popup>

        <Popup title="Switch Branch" ref="switchModal">
          <div className="parameters-col_description">
            <p>Select the Branch to open.</p>
            <div className="topbar-popup-item">
              <label>Branch:</label>
              <section>
                <select name="selectedBranchTarget" onChange={this.handleChange}>
                  <option key="null" value="null">-- Branch --</option>
                  { this.state.branchList && this.state.branchList.map(branch => <option key={branch} value={branch}>{branch}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.switchBranch}>Switch</button>
          </div>
        </Popup>

        <Popup title="Merge Branch" ref="mergeModal">
          <div className="parameters-col_description">
          <p>Enter the Branch Infomation to rename.</p>
            <div className="topbar-popup-item">
              <label>From Branch:</label>
              <section>
                <select name="selectedBranchSource" onChange={this.handleChange}>
                  <option key="null" value="null">-- Branch --</option>
                  { this.state.branchList && this.state.branchList.map(branch => <option key={branch} value={branch}>{branch}</option>) }
                </select>
              </section>
            </div>
            <div className="topbar-popup-item">
              <label>To Branch:</label>
              <section>
                <select name="selectedBranchTarget" onChange={this.handleChange}>
                  <option key="null" value="null">-- Branch --</option>
                  { this.state.branchList && this.state.branchList.map(branch => <option key={branch} value={branch}>{branch}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.merge}>Merge</button>
          </div>
        </Popup>


        <Popup title="Add tag" ref="addTagModal">
          <div className="parameters-col_description">
            <p>Enter the Tag Infomation to create.</p>
            <div className="topbar-popup-item">
              <label>From GitObject (Branch or Tag):</label>
              <section>
                <select name="selectedGitObject" onChange={this.handleChange}>
                  <option key="null" value="null">-- GitObject --</option>
                  { this.state.gitObjectList && this.state.gitObjectList.map(gitObject => <option key={gitObject} value={gitObject}>{gitObject}</option>) }
                </select>
              </section>
            </div>
            <div className="topbar-popup-item">
              <label>Add Tag Name:</label>
              <section>
                <input type="text" name="targetTag" onChange={this.handleChange}/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.addTag}>Create</button>
          </div>
        </Popup>

        <Popup title="Rename Tag" ref="renameTagModal">
          <div className="parameters-col_description">
          <p>Enter the Tag Infomation to rename.</p>
            <div className="topbar-popup-item">
              <label>From Tag:</label>
              <section>
                <select name="selectedTag" onChange={this.handleChange}>
                  <option key="null" value="null">-- Tag --</option>
                  { this.state.tagList && this.state.tagList.map(tag => <option key={tag} value={tag}>{tag}</option>) }
                </select>
              </section>
            </div>
            <div className="topbar-popup-item">
              <label>To Tag Name:</label>
              <section>
                <input type="text" name="targetTag" onChange={this.handleChange}/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.renameTag}>Rename</button>
          </div>
        </Popup>

        <Popup title="Delete Tag" ref="deleteTagModal">
          <div className="parameters-col_description">
            <p>Select the Tag to delete.</p>
            <div className="topbar-popup-item">
              <label>Tag:</label>
              <section>
                <select name="selectedTag" onChange={this.handleChange}>
                  <option key="null" value="null">-- Tag --</option>
                  { this.state.tagList && this.state.tagList.map(tag => <option key={tag} value={tag}>{tag}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.deleteTag}>Delete</button>
          </div>
        </Popup>


        <NotificationSystem ref="notificationSystem" allowHTML={true} />
      </div>
    )
  }
}

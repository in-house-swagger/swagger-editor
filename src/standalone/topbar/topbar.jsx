import React, { PropTypes } from "react"
import Swagger from "swagger-client"
import "whatwg-fetch"
import DropdownMenu from "./DropdownMenu"
import Popup from "./Popup"
import downloadFile from "react-file-download"
import YAML from "js-yaml"
import beautifyJson from "json-beautify"
import NotificationSystem from 'react-notification-system';

import "react-dd-menu/dist/react-dd-menu.css"
import "./topbar.less"
import Logo from "./logo_small.png"

export default class Topbar extends React.Component {
  constructor(props, context) {
    super(props, context)

    Swagger("/api/swagger.json", {
      requestInterceptor: (req) => {
        req.headers["Accept"] = "application/json"
        req.headers["content-type"] = "application/json"
      }
    })
      .then(client => {
        this.setState({ swaggerClient: client })
        client.apis.clients.clientOptions()
          .then(res => {
            this.setState({ clients: res.body })
          })
        client.apis.servers.serverOptions()
          .then(res => {
            this.setState({ servers: res.body })
          })
      })

    this.state = {
      swaggerClient: null,
      clients: [],
      servers: [],
      curSpecMgr: "http://localhost:8081/v1",
      curUser: "spec-mgr",
      curBranch: "master",
      curSpecId: null,
      specIdList: [],
      selectedSpecId: null
    }

    this.handleChange = this.handleChange.bind(this)
    this.syncSpecIdlist()
  }

  handleChange = (event) => {
    this.setState({[event.target.name]: event.target.value})
  }


  // Menu actions

  open = () => {
    let targetSpecId = this.state.selectedSpecId
    if(!targetSpecId) {
      this.noticeError("SpecID is not selected")
      return
    }

    let errorTitle = "failed to open Spec"
    let url = this.state.curSpecMgr + "/specs/" + targetSpecId
    fetch(url).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(text)))
        this.setState({["curSpecId"]: targetSpecId})
        this.hideOpenModal()
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  syncSpecIdlist = () => {
    let errorTitle = "failed to get Spec list"
    let url = this.state.curSpecMgr + "/specs"
    fetch(url).then(res => {
      res.json().then(json => this.setState({["specIdList"]: json.payload.idList}))
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  delete = () => {
    let targetSpecId = this.state.selectedSpecId
    let url = this.state.curSpecMgr + "/specs/" + targetSpecId

    if(!targetSpecId) {
      this.noticeError("SpecID is not selected")
      return
    }

    let errorTitle = "failed to delete Spec"
    fetch(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/x-yaml',
        'Content-Type': 'application/x-yaml',
      }
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        if (targetSpecId === this.state.curSpecId) this.setState({["curSpecId"]: null})
        this.noticeSuccess(targetSpecId + " has been deleted.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideDeleteModal()
  }

  saveNew = () => {
    let targetSpecId = this.state.curSpecId
    if (!targetSpecId) {
      this.noticeError("SpecID is Empty")
      return
    }

    let url = this.state.curSpecMgr + "/specs/" + targetSpecId
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let yamlContent = YAML.safeDump(jsContent)

    let errorTitle = "failed to create Spec"
    fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/x-yaml',
        'Content-Type': 'application/x-yaml',
      },
      body: yamlContent
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.setState({["curSpecId"]: null})
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(text)))
        this.setState({["curSpecId"]: targetSpecId})
        this.noticeSuccess(targetSpecId + " has been created.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))

    this.hideSaveNewModal()
  }

  save = () => {
    let targetSpecId = this.state.curSpecId
    if (!targetSpecId) {
      this.noticeError("SpecID is Empty")
      return
    }

    let url = this.state.curSpecMgr + "/specs/" + targetSpecId
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let yamlContent = YAML.safeDump(jsContent)

    let errorTitle = "failed to save Spec"
    fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/x-yaml',
        'Content-Type': 'application/x-yaml',
      },
      body: yamlContent
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.setState({["curSpecId"]: null})
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(text)))
        this.setState({["curSpecId"]: targetSpecId})
        this.noticeSuccess(targetSpecId + " has been saved.")
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }


  importFromURL = () => {
    let url = this.refs.urlLoadInput.value

    if(url) {
      fetch(url)
        .then(res => res.text())
        .then(text => {
          this.props.specActions.updateSpec(
            YAML.safeDump(YAML.safeLoad(text))
          )
          this.hideImportUrlModal()
        })
    }
  }

  importFromFile = () => {
    let fileToLoad = this.refs.fileLoadInput.files.item(0)
    let fileReader = new FileReader()

    fileReader.onload = fileLoadedEvent => {
      let textFromFileLoaded = fileLoadedEvent.target.result
      this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(textFromFileLoaded)))
      this.hideImportFileModal()
    }

    fileReader.readAsText(fileToLoad, "UTF-8")
  }

  saveAsYaml = () => {
    // Editor content -> JS object -> YAML string
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let yamlContent = YAML.safeDump(jsContent)
    downloadFile(yamlContent, "swagger.yaml")
  }

  saveAsJson = () => {
    // Editor content  -> JS object -> Pretty JSON string
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let prettyJsonContent = beautifyJson(jsContent, null, 2)
    downloadFile(prettyJsonContent, "swagger.json")
  }

  saveAsText = () => {
    // Download raw text content
    let editorContent = this.props.specSelectors.specStr()
    downloadFile(editorContent, "swagger.txt")
  }

  convertToYaml = () => {
    // Editor content -> JS object -> YAML string
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let yamlContent = YAML.safeDump(jsContent)
    this.props.specActions.updateSpec(yamlContent)
  }

  downloadGeneratedFile = (type, name) => {
    let { specSelectors } = this.props
    let swaggerClient = this.state.swaggerClient
    if(!swaggerClient) {
      // Swagger client isn't ready yet.
      return
    }
    if(type === "server") {
      swaggerClient.apis.servers.generateServerForLanguage({
        framework : name,
        body: JSON.stringify({
          spec: specSelectors.specJson()
        }),
        headers: JSON.stringify({
          Accept: "application/json"
        })
      })
        .then(res => handleResponse(res))
    }

    if(type === "client") {
      swaggerClient.apis.clients.generateClient({
        language : name,
        body: JSON.stringify({
          spec: specSelectors.specJson()
        })
      })
        .then(res => handleResponse(res))
    }

    function handleResponse(res) {
      if(!res.ok) {
        return console.error(res)
      }

      fetch(res.body.link)
        .then(res => res.blob())
        .then(res => {
          downloadFile(res, `${name}-${type}-generated.zip`)
        })
    }

  }

  clearEditor = () => {
    if(window.localStorage) {
      window.localStorage.removeItem("swagger-editor-content")
      this.props.specActions.updateSpec("")
    }
  }


  // Helpers

  showOpenModal = () => {
    this.syncSpecIdlist()
    this.state.selectedSpecId = null
    this.refs.openModal.show()
  }
  hideOpenModal = () => { this.refs.openModal.hide() }

  showDeleteModal = () => {
    this.syncSpecIdlist()
    this.state.selectedSpecId = null
    this.refs.deleteModal.show()
  }
  hideDeleteModal = () => { this.refs.deleteModal.hide() }

  showSaveNewModal = () => { this.refs.saveNewModal.show() }
  hideSaveNewModal = () => { this.refs.saveNewModal.hide() }

  showImportUrlModal = () => { this.refs.importUrlModal.show() }
  hideImportUrlModal = () => { this.refs.importUrlModal.hide() }

  showImportFileModal = () => { this.refs.importFileModal.show() }
  hideImportFileModal = () => { this.refs.importFileModal.hide() }


  // notification

  handleSpecMgrError = (errorTitle, specId, text) => {
    let yaml = YAML.safeLoad(text)
    if (yaml) {
      this.noticeListError(errorTitle + ": " + specId, yaml._errors.list)
    } else {
      this.noticeError(errorTitle + ": " + specId, text)
    }
  }
  noticeListError = (title, errorList) => {
    for (let i = 0; i < errorList.length; i++) {
      let key = errorList[i].propertyKey
      let message = errorList[i].message
      console.error("key: " + key, "message: " + message)
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
    let { getComponent, specSelectors: { isOAS3 } } = this.props
    const Link = getComponent("Link")

    let showGenerateMenu = !(isOAS3 && isOAS3())

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
      <div>
        <div className="topbar">
          <div className="topbar-wrapper">
            <Link href="#">
              <img height="30" width="30" className="topbar-logo__img" src={ Logo } alt=""/>
              <span className="topbar-logo__title">Swagger Editor</span>
            </Link>

            <DropdownMenu {...makeMenuOptions("File")}>
              <li><button type="button" onClick={this.showOpenModal}>Open</button></li>
              <li><button type="button" onClick={this.showSaveNewModal}>Save as...</button></li>
              <li><button type="button" onClick={this.save}>Save</button></li>
              <li><button type="button" onClick={this.showDeleteModal}>Delete</button></li>
              <li role="separator"></li>
              <li><button type="button" onClick={this.showImportUrlModal}>Import URL</button></li>
              <li><button type="button" onClick={this.showImportFileModal}>Import File</button></li>
              <li role="separator"></li>
              <li><button type="button" onClick={this.saveAsYaml}>Download YAML</button></li>
              <li><button type="button" onClick={this.saveAsJson}>Download JSON</button></li>
            </DropdownMenu>

            <DropdownMenu {...makeMenuOptions("Edit")}>
              <li><button type="button" onClick={this.convertToYaml}>Convert to YAML</button></li>
              <li role="separator"></li>
              <li><button type="button" onClick={this.clearEditor}>Clear editor</button></li>
            </DropdownMenu>

            { showGenerateMenu ? <DropdownMenu className="long" {...makeMenuOptions("Generate Server")}>
              { this.state.servers
                  .map(serv => <li><button type="button" onClick={this.downloadGeneratedFile.bind(null, "server", serv)}>{serv}</button></li>) }
            </DropdownMenu> : null }

            { showGenerateMenu ? <DropdownMenu className="long" {...makeMenuOptions("Generate Client")}>
              { this.state.clients
                  .map(cli => <li><button type="button" onClick={this.downloadGeneratedFile.bind(null, "client", cli)}>{cli}</button></li>) }
            </DropdownMenu> : null }

            <div className="topbar-specmgr-info">
              <span className="item">SpecID : {this.state.curSpecId}</span>
              <span className="item">Branch : {this.state.curBranch}</span>
              <span className="item">User : {this.state.curUser}</span>
            </div>
          </div>
        </div>

        <Popup title="Open" ref="openModal">
          <div className="parameters-col_description">
            <p>Select the SpecID to open:</p>
            <select name="selectedSpecId" onChange={this.handleChange}>
              <option key="null" value="null">-- SpecId --</option>
              { this.state.specIdList.map(specId => <option key={specId} value={specId}>{specId}</option>) }
            </select>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn modal-btn auth authorize button" onClick={this.open}>Open</button>
          </div>
        </Popup>

        <Popup title="Delete" ref="deleteModal">
          <div className="parameters-col_description">
            <p>Select the SpecID to delete:</p>
            <select name="selectedSpecId" onChange={this.handleChange}>
              <option key="null" value="null">-- SpecId --</option>
              { this.state.specIdList.map(specId => <option key={specId} value={specId}>{specId}</option>) }
            </select>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn modal-btn auth authorize button" onClick={this.delete}>Delete</button>
          </div>
        </Popup>

        <Popup title="Save as" ref="saveNewModal">
          <div className="parameters-col_description">
            <p>Enter the SpecID to create:</p>
            <input type="text" name="curSpecId" onChange={this.handleChange}/>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn modal-btn auth authorize button" onClick={this.saveNew}>Create</button>
          </div>
        </Popup>

        <Popup title="Import URL" ref="importUrlModal">
          <div className="parameters-col_description">
            <p>Enter the URL to import from:</p>
            <input ref="urlLoadInput" type="text"/>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn modal-btn auth authorize button" onClick={this.importFromURL}>Import</button>
          </div>
        </Popup>

        <Popup title="Upload file" ref="importFileModal">
          <div className="parameters-col_description">
            <p>Choose the File to import from:</p>
            <input ref="fileLoadInput" type="file"/>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn modal-btn auth authorize button" onClick={this.importFromFile}>Import</button>
          </div>
        </Popup>

        <NotificationSystem ref="notificationSystem" allowHTML={true} />
      </div>
    )
  }
}

Topbar.propTypes = {
  specSelectors: PropTypes.object.isRequired,
  specActions: PropTypes.object.isRequired,
  getComponent: PropTypes.func.isRequired
}

import React, { PropTypes } from "react"
import Swagger from "swagger-client"
import "whatwg-fetch"
import CodegenOptionPopup from "./CodegenOptionPopup"
import DropdownMenu from "./DropdownMenu"
import Popup from "./Popup"
import downloadFile from "react-file-download"
import YAML from "js-yaml"
import beautifyJson from "json-beautify"
import NotificationSystem from 'react-notification-system';

import SpecMgrMenu from './SpecMgrMenu'

import "react-dd-menu/dist/react-dd-menu.css"
import "./topbar.less"
import Logo from "./logo_small.png"

export default class Topbar extends React.Component {
  constructor(props, context) {
    super(props, context)

    let url = "http://" + window.location.host
// for npm run dev
//     let url = "http://localhost:8080"
    Swagger(url + "/api/swagger.json", {
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

      curSpecId: null,
      specIdList: [],
      selectedSpecId: null
    }

    this.handleChange = this.handleChange.bind(this)
  }

  handleChange = (event) => {
    this.setState({[event.target.name]: event.target.value})
  }

  updateState = (state) => {
    this.setState(state);
  }

  isRequestProcessing = () => {
    if (!this.refs.specMgrMenu) return false
    return this.refs.specMgrMenu.isRequestProcessing()
  }

  // Menu actions

  open = () => {
    let targetSpecId = this.state.selectedSpecId
    if(!targetSpecId) {
      this.noticeError("SpecID is not selected")
      return
    }

    let errorTitle = "failed to open Spec"
    let url = this.refs.specMgrMenu.state.curSpecMgr + "/specs/" + targetSpecId
    let headers = this.refs.specMgrMenu.getRequestHeaders('application/x-yaml')
    this.refs.specMgrMenu.requestStart()
    fetch(url, {
      method: 'GET',
      headers: headers
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(text)))
        this.setState({["curSpecId"]: targetSpecId})
        this.refs.specMgrMenu.requestEnd()
        this.hideOpenModal()
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  syncSpecIdlist = () => {
    let errorTitle = "failed to get Spec list"
    let url = this.refs.specMgrMenu.state.curSpecMgr + "/specs"
    let headers = this.refs.specMgrMenu.getRequestHeaders(null)
    fetch(url, {
      method: 'GET',
      headers: headers
    }).then(res => {
      res.json().then(json => this.setState({["specIdList"]: json.payload.idList}))
    })
    .catch(error => this.noticeError(errorTitle, error))
  }

  delete = () => {
    let targetSpecId = this.state.selectedSpecId
    let url = this.refs.specMgrMenu.state.curSpecMgr + "/specs/" + targetSpecId

    if(!targetSpecId) {
      this.noticeError("SpecID is not selected")
      return
    }

    let errorTitle = "failed to delete Spec"
    let headers = this.refs.specMgrMenu.getRequestHeaders('application/x-yaml')
    this.refs.specMgrMenu.requestStart()
    fetch(url, {
      method: 'DELETE',
      headers: headers
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        if (targetSpecId == this.state.curSpecId) this.setState({["curSpecId"]: null})
        this.noticeSuccess(targetSpecId + " has been deleted.")
        this.refs.specMgrMenu.requestEnd()
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

    let url = this.refs.specMgrMenu.state.curSpecMgr + "/specs/" + targetSpecId
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let yamlContent = YAML.safeDump(jsContent)

    let errorTitle = "failed to create Spec"
    let headers = this.refs.specMgrMenu.getRequestHeaders('application/x-yaml')
    this.refs.specMgrMenu.requestStart()
    fetch(url, {
      method: 'POST',
      headers: headers,
      body: yamlContent
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(text)))
        this.setState({["curSpecId"]: targetSpecId})
        this.noticeSuccess(targetSpecId + " has been created.")
        this.refs.specMgrMenu.requestEnd()
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

    let url = this.refs.specMgrMenu.state.curSpecMgr + "/specs/" + targetSpecId
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let yamlContent = YAML.safeDump(jsContent)

    let errorTitle = "failed to save Spec"
    let headers = this.refs.specMgrMenu.getRequestHeaders('application/x-yaml')
    this.refs.specMgrMenu.requestStart()
    fetch(url, {
      method: 'PUT',
      headers: headers,
      body: yamlContent
    }).then(res => {
      res.text().then(text => {
        if (!res.ok) {
          this.handleSpecMgrError(errorTitle, targetSpecId, text)
          return
        }

        this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(text)))
        this.setState({["curSpecId"]: targetSpecId})
        this.noticeSuccess(targetSpecId + " has been saved.")
        this.refs.specMgrMenu.requestEnd()
      })
    })
    .catch(error => this.noticeError(errorTitle, error))
  }


  importFromURL = () => {
    let url = this.refs.urlLoadInput.value

    if(url) {
      this.refs.specMgrMenu.requestStart()
      fetch(url)
        .then(res => res.text())
        .then(text => {
          this.props.specActions.updateSpec(
            YAML.safeDump(YAML.safeLoad(text))
          )
          this.setState({["curSpecId"]: "IMPORTED"})
          this.refs.specMgrMenu.requestEnd()
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

      this.setState({["curSpecId"]: "IMPORTED"})
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

  downloadGeneratedFile = (type, name, options) => {
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
          options: options,
          spec: specSelectors.specJson()
        }),
        headers: JSON.stringify({
          Accept: "application/json"
        })
      })
        .then(res => handleResponse(res))
        .catch(err => {
          let errorObj = JSON.parse(err.response.text)
          if (errorObj) this.noticeError('failed to generate', errorObj.message)
        })
    }

    if(type === "client") {
      swaggerClient.apis.clients.generateClient({
        language : name,
        body: JSON.stringify({
          options: options,
          spec: specSelectors.specJson()
        })
      })
        .then(res => handleResponse(res))
        .catch(err => {
          let errorObj = JSON.parse(err.response.text)
          if (errorObj) this.noticeError('failed to generate', errorObj.message)
        })
    }

    function handleResponse(res) {
      if(!res.ok) {
        this.props.noticeError(res.message)
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

  showGenerateModal = (type, name) => { this.refs.generateModal.show(type, name) }


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
                  .map(serv => <li><button type="button" onClick={this.showGenerateModal.bind(null, "server", serv)}>{serv}</button></li>) }
            </DropdownMenu> : null }

            { showGenerateMenu ? <DropdownMenu className="long" {...makeMenuOptions("Generate Client")}>
              { this.state.clients
                  .map(cli => <li><button type="button" onClick={this.showGenerateModal.bind(null, "client", cli)}>{cli}</button></li>) }
            </DropdownMenu> : null }

            <SpecMgrMenu ref="specMgrMenu" updateState={this.updateState.bind(this)} >{this.state.curSpecId}</SpecMgrMenu>
          </div>
        </div>

        <Popup title="Open" ref="openModal">
          <div className="parameters-col_description">
            <p>Select the Spec Information to open.</p>
            <div className="topbar-popup-item">
              <label>SpecID:</label>
              <section>
                <select name="selectedSpecId" onChange={this.handleChange}>
                  <option key="null" value="null">-- SpecId --</option>
                  { this.state.specIdList.map(specId => <option key={specId} value={specId}>{specId}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.open}>Open</button>
          </div>
        </Popup>

        <Popup title="Delete" ref="deleteModal">
          <div className="parameters-col_description">
            <p>Select the Spec Information to delete.</p>
            <div className="topbar-popup-item">
              <label>SpecID:</label>
              <section>
                <select name="selectedSpecId" onChange={this.handleChange}>
                  <option key="null" value="null">-- SpecId --</option>
                  { this.state.specIdList.map(specId => <option key={specId} value={specId}>{specId}</option>) }
                </select>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.delete}>Delete</button>
          </div>
        </Popup>

        <Popup title="Save as" ref="saveNewModal">
          <div className="parameters-col_description">
            <p>Select the Spec Information to create.</p>
            <div className="topbar-popup-item">
              <label>SpecID:</label>
              <section>
                <input type="text" name="curSpecId" onChange={this.handleChange}/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.saveNew}>Create</button>
          </div>
        </Popup>

        <Popup title="Import URL" ref="importUrlModal">
          <div className="parameters-col_description">
            <p>Enter the URL to import.</p>
            <div className="topbar-popup-item">
              <label>URL:</label>
              <section>
                <input ref="urlLoadInput" type="text"/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" disabled={this.isRequestProcessing()} onClick={this.importFromURL}>Import</button>
          </div>
        </Popup>

        <Popup title="Upload file" ref="importFileModal">
          <div className="parameters-col_description">
            <p>Choose the File to import.</p>
            <div className="topbar-popup-item">
              <label>File:</label>
              <section>
                <input ref="fileLoadInput" type="file"/>
              </section>
            </div>
          </div>
          <div className="topbar-popup-button-area">
            <button className="btn authorize" onClick={this.importFromFile}>Import</button>
          </div>
        </Popup>

        <CodegenOptionPopup
          ref="generateModal"
          updateState={this.updateState.bind(this)}
          swaggerClient={this.state.swaggerClient}
          noticeSuccess={this.noticeSuccess}
          noticeError={this.noticeError}
          downloadGeneratedFile={this.downloadGeneratedFile}
          />

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

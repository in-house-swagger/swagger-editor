import React from "react"
import PropTypes from "prop-types"
import Modal from "boron/DropModal"
import Swagger from "swagger-client"
import beautifyJson from "json-beautify"

export default class CodegenOptionPopup extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    children: PropTypes.node,
  }

  constructor(props, context) {
    super(props, context)

    this.state = {
      isShowDef: true,
      isShowValue: false,

      selectedCodegenType: null,
      selectedCodegenName: null,
      selectedCodegenOptDef: null,
      selectedCodegenOptValue: null
    }

    this.handleChange = this.handleChange.bind(this)
  }

  handleChange = (event) => {
    this.setState({[event.target.name]: event.target.value})
  }

  show = (type, name) => {
    this.setState({ ["selectedCodegenType"]: type })
    this.setState({ ["selectedCodegenName"]: name })

    this.state.selectedCodegenOptDef = this.getCodegenOptDef(type, name)
    let codegenOptValue = this.getCodegenOptValue(type, name)
    this.state.selectedCodegenOptValue = codegenOptValue
    if (!codegenOptValue) this.syncDefaultCodegenOpt(type, name)

    this.refs.modal.show()
  }
  hide = () => {
    this.refs.modal.hide()
  }
  close = () => {
    this.hide()
  }



  syncDefaultCodegenOpt = (type, name) => {
    this.clearCodegenOptDef(type, name)
    this.clearCodegenOptValue(type, name)

    let swaggerClient = this.props.swaggerClient
    if (type === 'server') {
      swaggerClient.apis.servers.getServerOptions({
        framework : name
      }).then(res => { this.handleCodegenOptResponse(type, name, res) })
    }
    if (type === 'client') {
      swaggerClient.apis.clients.getClientOptions({
        language : name
      }).then(res => { this.handleCodegenOptResponse(type, name, res) })
    }
  }
  handleCodegenOptResponse = (type, name, res) => {
    if(!res.ok) {
      this.props.noticeError(res.message)
      return console.error(res)
    }
    // codegenOptDef を保存
    this.saveCodegenOptDef(type, name, beautifyJson(res.obj, null, 2))
    // codegenOptValue のデフォルト値を保存
    let defaultCodegenOptValue = {}
    Object.keys(res.obj).forEach(key => {
      let curOptionDef = res.obj[key]
      if (curOptionDef.default) {
        defaultCodegenOptValue[curOptionDef.opt] = curOptionDef.default
        return
      }
      defaultCodegenOptValue[curOptionDef.opt] = null
    })
    this.saveCodegenOptValue(type, name, beautifyJson(defaultCodegenOptValue, null, 2))
  }



  getCodegenOptValue = (type, name) => {
    return window.localStorage.getItem(this.getCodegenOptValueKey(type, name));
  }
  getCodegenOptDef = (type, name) => {
    return window.localStorage.getItem(this.getCodegenOptDefKey(type, name));
  }

  saveCodegenOptValue = (type, name, content) => {
    window.localStorage.setItem(this.getCodegenOptValueKey(type, name), content)
    this.setState({ ["selectedCodegenOptValue"]: content })
  }
  saveCodegenOptDef = (type, name, content) => {
    window.localStorage.setItem(this.getCodegenOptDefKey(type, name), content)
    this.setState({ ["selectedCodegenOptDef"]: content })
  }

  clearCodegenOptValue = (type, name) => {
    window.localStorage.removeItem(this.getCodegenOptDefKey(type, name))
  }
  clearCodegenOptDef = (type, name) => {
    window.localStorage.removeItem(this.getCodegenOptValueKey(type, name))
  }

  getCodegenOptDefKey = (type, name) => {
    return this.getCodegenOptKey(type, name) + '.def'
  }
  getCodegenOptValueKey = (type, name) => {
    return this.getCodegenOptKey(type, name) + '.value'
  }
  getCodegenOptKey = (type, name) => {
    return 'swagger-generator.opt.' + type + '.' + name
  }



  resetCodegenOpt = () => {
    this.syncDefaultCodegenOpt(this.state.selectedCodegenType, this.state.selectedCodegenName)
  }
  saveCodegenOpt = () => {
    let type = this.state.selectedCodegenType
    let name = this.state.selectedCodegenName
    let value = this.state.selectedCodegenOptValue
    this.saveCodegenOptValue(type, name, value)
    this.props.noticeSuccess(type + " / " + name + " option has been saved.")
  }
  generate = () => {
    let type = this.state.selectedCodegenType
    let name = this.state.selectedCodegenName
    let value = this.state.selectedCodegenOptValue
    this.saveCodegenOptValue(type, name, value)
    this.props.downloadGeneratedFile(type, name, JSON.parse(value))
    this.hide()
  }



  showDef = () => {
    this.setState({ ["isShowDef"]: true })
    this.setState({ ["isShowValue"]: false })
  }
  showValue = () => {
    this.setState({ ["isShowDef"]: false })
    this.setState({ ["isShowValue"]: true })
  }


  render() {
    let generateModalTitle = () => {
      return 'Edit Codegen Option - ' + this.state.selectedCodegenType + ' / ' + this.state.selectedCodegenName
    }

    let isShowDef = () => {
      if (this.state.isShowDef) return "show"
      return "hide"
    }

    let isShowValue = () => {
      if (this.state.isShowValue) return "show"
      return "hide"
    }

    return (
      <Modal ref="modal"
        className="swagger-ui"
        backdropStyle={{background: "rgba(0,0,0,.8)"}} >

        <div className="dialog-ux">
          <div className="modal-ux modal-ux-wide">
            <div className="modal-dialog-ux">
              <div className="modal-ux-inner">
                <div className="modal-ux-header">
                  <h3>{generateModalTitle()}</h3>
                  <button type="button" className="close-modal" onClick={ this.close }>
                    <svg width="20" height="20">
                      <use href="#close" xlinkHref="#close" />
                    </svg>
                  </button>
                </div>

                <div className="modal-ux-content">
                  <table className="parameters"><tbody>
                    <tr>
                      <td className="parameters-col_name">
                        <a onClick={() => this.showDef()} >Option Definition</a><br/>
                        <a onClick={() => this.showValue()} >Option Value</a><br/>
                      </td>

                      <td className="parameters-col_description">
                        <div className={isShowDef()}>
                          <div className="topbar-popup-item">
                            <label>Option Definition</label>
                            <textarea disabled="true" className="codegen-opt-edit" value={this.state.selectedCodegenOptDef}></textarea>
                          </div>
                        </div>

                        <div className={isShowValue()}>
                          <div className="topbar-popup-item">
                            <label>Option Value</label>
                            <textarea name="selectedCodegenOptValue" className="codegen-opt-edit" onChange={this.handleChange} value={this.state.selectedCodegenOptValue}></textarea>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody></table>
                </div>

                <div className="modal-ux-footer">
                  <button className="btn" onClick={this.resetCodegenOpt}>Reset</button>
                  <span className="separator"></span>
                  <button className="btn" onClick={this.saveCodegenOpt}>Save</button>
                  <span className="separator"></span>
                  <button className="btn authorize" onClick={this.generate}>Generate</button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </Modal>
    )
  }
}

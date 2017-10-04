import React from "react"
import PropTypes from "prop-types"
import Modal from "boron/DropModal"

export default class Popup extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    children: PropTypes.node
  }

  show = () => {
   this.refs.modal.show()
  }
  hide = () => {
   this.refs.modal.hide()
  }
  close = () => {
    this.hide()
  }

  render() {
    return (
      <Modal ref="modal"
        className="swagger-ui"
        backdropStyle={{background: "rgba(0,0,0,.8)"}} >

        <div className="dialog-ux">
          <div className="modal-ux">
            <div className="modal-dialog-ux">
              <div className="modal-ux-inner">
                <div className="modal-ux-header">
                  <h3>{this.props.title}</h3>
                  <button type="button" className="close-modal" onClick={ this.close }>
                    <svg width="20" height="20">
                      <use href="#close" xlinkHref="#close" />
                    </svg>
                  </button>
                </div>
                <div className="modal-ux-content">
                  {this.props.children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    )
  }
}

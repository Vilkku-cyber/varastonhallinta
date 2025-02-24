import React from "react";
import Modal from "react-modal";
import EditTrip from "./EditTrip";
import styles from "./CreateTripModal.module.css";

Modal.setAppElement("#root");

function EditTripModal({ isOpen, onRequestClose, tripId }) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Edit Trip"
      className={styles.modal}
      overlayClassName={styles.overlay}
    >
      <div className={styles.modalContent}>
        <EditTrip onRequestClose={onRequestClose} tripId={tripId} />
      </div>
    </Modal>
  );
}

export default EditTripModal;
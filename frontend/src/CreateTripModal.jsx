import React from "react";
import Modal from "react-modal";
import CreateTrip from "./CreateTrip";
import styles from "./CreateTripModal.module.css";

Modal.setAppElement("#root");

function CreateTripModal({ isOpen, onRequestClose, initialSeed, onCreated }) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Create Trip"
      className={styles.modal}
      overlayClassName={styles.overlay}
    >
      <div className={styles.modalContent}>
        {/* VÄLITÄ SUUNNITELMAN TAVARAT MODALIN SISÄLLE */}
        <CreateTrip
          onRequestClose={onRequestClose}
          initialSeed={initialSeed}
          onCreated={onCreated}
        />
      </div>
    </Modal>
  );
}

export default CreateTripModal;

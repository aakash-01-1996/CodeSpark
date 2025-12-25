import React from "react";

const DeleteApprovalModal = ({
  isOpen,
  username,
  deletedCode,
  onApprove,
  onReject,
}) => {
  if (!isOpen) return null;

  // Truncate code if too long
  const displayCode =
    deletedCode?.length > 200
      ? deletedCode.substring(0, 200) + "..."
      : deletedCode;

  return (
    <div className="modalOverlay">
      <div className="modalContent">
        <div className="modalHeader">
          <span className="modalIcon">⚠️</span>
          <h3>Deletion Request</h3>
        </div>
        <p className="modalMessage">
          <strong>{username}</strong> wants to delete some code:
        </p>
        <div className="codePreview">
          <pre>{displayCode}</pre>
        </div>
        <p className="modalQuestion">Do you approve this deletion?</p>
        <div className="modalActions">
          <button className="btn rejectBtn" onClick={onReject}>
            ❌ Reject
          </button>
          <button className="btn approveBtn" onClick={onApprove}>
            ✅ Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteApprovalModal;

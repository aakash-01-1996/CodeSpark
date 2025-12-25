const ACTIONS = {
  JOIN: "join",
  JOINED: "joined",
  DISCONNECTED: "disconnected",
  CODE_CHANGE: "code-change",
  SYNC_CODE: "sync-code",
  LEAVE: "leave",
  // Deletion approval actions
  DELETE_REQUEST: "delete-request",
  DELETE_APPROVED: "delete-approved",
  DELETE_REJECTED: "delete-rejected",
  DELETE_CANCELLED: "delete-cancelled",
  // Typing indicator
  TYPING: "typing",
  STOP_TYPING: "stop-typing",
};

module.exports = ACTIONS;

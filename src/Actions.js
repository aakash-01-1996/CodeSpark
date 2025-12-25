const ACTIONS = {
  JOIN: "join",
  JOINED: "joined",
  DISCONNECTED: "disconnected",
  CODE_CHANGE: "code-change",
  SYNC_CODE: "sync-code",
  LEAVE: "leave",
};

// ES Module export for React
export default ACTIONS;

// CommonJS export for Node.js server
if (typeof module !== "undefined") {
  module.exports = ACTIONS;
}

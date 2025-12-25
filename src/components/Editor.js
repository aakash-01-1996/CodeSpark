import React, { useEffect, useRef } from "react";
import Codemirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import ACTIONS from "../Actions";

const DELETION_THRESHOLD = 5;
const TYPING_TIMEOUT = 1000;

// Generate a consistent color from username
const stringToColor = (str) => {
  if (!str) return "#888888";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
    "#F8B500",
    "#FF8C00",
    "#00CED1",
    "#FF69B4",
    "#32CD32",
  ];
  return colors[Math.abs(hash) % colors.length];
};

// Get initials from username
const getInitials = (name) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

// Export for use in other components
export { stringToColor, getInitials };

const Editor = ({
  socketRef,
  roomId,
  onCodeChange,
  clientsCount = 1,
  username,
  pendingDeletion,
  onDeletionRequest,
  editorRef: externalEditorRef,
  lineAuthors,
  onLineAuthorsChange,
  setRemoteCode,
}) => {
  const internalEditorRef = useRef(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const previousCodeRef = useRef("");
  const isRemoteChangeRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const lineAuthorsRef = useRef(lineAuthors || {});
  const gutterUpdateTimeoutRef = useRef(null);
  const setRemoteCodeRef = useRef(setRemoteCode);

  // Refs for event handlers
  const clientsCountRef = useRef(clientsCount);
  const pendingDeletionRef = useRef(pendingDeletion);
  const onDeletionRequestRef = useRef(onDeletionRequest);
  const socketRefRef = useRef(socketRef);
  const roomIdRef = useRef(roomId);
  const onCodeChangeRef = useRef(onCodeChange);
  const usernameRef = useRef(username);
  const onLineAuthorsChangeRef = useRef(onLineAuthorsChange);

  // Sync refs with props
  useEffect(() => {
    clientsCountRef.current = clientsCount;
  }, [clientsCount]);
  useEffect(() => {
    pendingDeletionRef.current = pendingDeletion;
  }, [pendingDeletion]);
  useEffect(() => {
    onDeletionRequestRef.current = onDeletionRequest;
  }, [onDeletionRequest]);
  useEffect(() => {
    socketRefRef.current = socketRef;
  }, [socketRef]);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);
  useEffect(() => {
    lineAuthorsRef.current = lineAuthors || {};
  }, [lineAuthors]);
  useEffect(() => {
    onLineAuthorsChangeRef.current = onLineAuthorsChange;
  }, [onLineAuthorsChange]);
  useEffect(() => {
    setRemoteCodeRef.current = setRemoteCode;
  }, [setRemoteCode]);

  // Update gutter to show authorship
  const updateAuthorshipGutter = (editor, authors) => {
    if (!editor) return;
    const lineCount = editor.lineCount();
    for (let i = 0; i < lineCount; i++) {
      const author = authors[i];
      if (author) {
        const color = stringToColor(author);
        const initials = getInitials(author);
        const marker = document.createElement("div");
        marker.className = "author-marker";
        marker.style.backgroundColor = color;
        marker.setAttribute("title", author);
        marker.textContent = initials;
        editor.setGutterMarker(i, "authorship-gutter", marker);
      } else {
        editor.setGutterMarker(i, "authorship-gutter", null);
      }
    }
  };

  // Debounced gutter update
  const scheduleGutterUpdate = () => {
    if (gutterUpdateTimeoutRef.current) {
      clearTimeout(gutterUpdateTimeoutRef.current);
    }
    gutterUpdateTimeoutRef.current = setTimeout(() => {
      updateAuthorshipGutter(editorRef.current, lineAuthorsRef.current);
    }, 50);
  };

  // Emit typing indicator
  const emitTyping = () => {
    const socket = socketRefRef.current?.current;
    if (socket) {
      socket.emit(ACTIONS.TYPING, {
        roomId: roomIdRef.current,
        username: usernameRef.current,
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit(ACTIONS.STOP_TYPING, {
          roomId: roomIdRef.current,
          username: usernameRef.current,
        });
      }, TYPING_TIMEOUT);
    }
  };

  // Update line authors when lines change
  const updateLineAuthors = (change, authorName) => {
    const authors = { ...lineAuthorsRef.current };
    const from = change.from.line;
    const to = change.to.line;
    const addedLines = change.text.length;
    const removedLines = to - from + 1;
    const lineDiff = addedLines - removedLines;

    // Shift authors for lines after the change
    if (lineDiff !== 0) {
      const newAuthors = {};
      Object.keys(authors).forEach((lineNum) => {
        const num = parseInt(lineNum);
        if (num < from) {
          newAuthors[num] = authors[num];
        } else if (num > to) {
          newAuthors[num + lineDiff] = authors[num];
        }
      });
      // Clear the modified range
      for (let i = from; i <= Math.max(to, from + addedLines - 1); i++) {
        delete authors[i];
      }
      // Apply shifted entries
      Object.keys(newAuthors).forEach((key) => {
        authors[key] = newAuthors[key];
      });
    }

    // Mark new/changed lines with author
    for (let i = 0; i < addedLines; i++) {
      if (change.text[i] !== "" || addedLines > 1) {
        authors[from + i] = authorName;
      }
    }

    lineAuthorsRef.current = authors;
    if (onLineAuthorsChangeRef.current) {
      onLineAuthorsChangeRef.current(authors);
    }
    return authors;
  };

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (editorRef.current) return;

    async function init() {
      editorRef.current = Codemirror.fromTextArea(
        document.getElementById("realtimeEditor"),
        {
          mode: { name: "javascript", json: true },
          theme: "dracula",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
        }
      );

      editorRef.current.on("beforeChange", (instance, change) => {
        if (isRemoteChangeRef.current) return;
        if (pendingDeletionRef.current) {
          change.cancel();
          return;
        }

        const removedText = change.removed ? change.removed.join("\n") : "";
        const addedText = change.text ? change.text.join("\n") : "";

        if (clientsCountRef.current <= 1) return;

        const isSignificantDeletion =
          removedText.length >= DELETION_THRESHOLD &&
          addedText.length < removedText.length;

        if (isSignificantDeletion) {
          change.cancel();
          const currentCode = instance.getValue();
          const from = change.from;
          const to = change.to;
          const lines = currentCode.split("\n");
          const beforeLines = lines.slice(0, from.line);
          const afterLines = lines.slice(to.line + 1);
          const middleLine =
            lines[from.line].substring(0, from.ch) +
            addedText +
            lines[to.line].substring(to.ch);
          const newCode = [...beforeLines, middleLine, ...afterLines].join(
            "\n"
          );

          if (onDeletionRequestRef.current) {
            onDeletionRequestRef.current({
              deletedCode: removedText,
              newCode: newCode,
            });
          }
        }
      });

      editorRef.current.on("change", (instance, change) => {
        const { origin } = change;
        const code = instance.getValue();
        previousCodeRef.current = code;

        if (onCodeChangeRef.current) {
          onCodeChangeRef.current(code);
        }

        if (origin !== "setValue" && !isRemoteChangeRef.current) {
          // Update authorship for changed lines
          const changedLines = [];
          const from = change.from.line;
          for (let i = 0; i < change.text.length; i++) {
            changedLines.push(from + i);
          }
          updateLineAuthors(change, usernameRef.current);
          scheduleGutterUpdate();

          const socket = socketRefRef.current?.current;
          if (socket) {
            socket.emit(ACTIONS.CODE_CHANGE, {
              roomId: roomIdRef.current,
              code,
              username: usernameRef.current,
              changedLines,
            });
            emitTyping();
          }
        }
      });

      // Initial gutter update
      scheduleGutterUpdate();
    }
    init();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (gutterUpdateTimeoutRef.current)
        clearTimeout(gutterUpdateTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update gutter when lineAuthors prop changes
  useEffect(() => {
    if (editorRef.current && lineAuthors) {
      lineAuthorsRef.current = lineAuthors;
      updateAuthorshipGutter(editorRef.current, lineAuthors);
    }
  }, [lineAuthors, editorRef]);

  // Expose method to set code from remote changes
  useEffect(() => {
    if (setRemoteCodeRef.current) {
      // Provide a callback to parent to set code as remote
      setRemoteCodeRef.current((code) => {
        if (editorRef.current && code !== undefined && code !== null) {
          // Save cursor position before setting value
          const cursor = editorRef.current.getCursor();
          const scrollInfo = editorRef.current.getScrollInfo();

          isRemoteChangeRef.current = true;
          editorRef.current.setValue(code);
          isRemoteChangeRef.current = false;

          // Restore cursor position after setting value
          editorRef.current.setCursor(cursor);
          editorRef.current.scrollTo(scrollInfo.left, scrollInfo.top);
        }
      });
    }
  }, [editorRef]);

  return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;

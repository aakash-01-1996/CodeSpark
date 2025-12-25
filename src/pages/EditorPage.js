// import React, { useEffect, useRef, useState } from "react";
// import Client from "../components/Client";
// import Editor from "../components/Editor";
// import { initSocket } from "../socket";
// import ACTIONS from "../Actions";
// import {
//   Navigate,
//   useLocation,
//   useNavigate,
//   useParams,
// } from "react-router-dom";
// import toast from "react-hot-toast";

// const EditorPage = () => {
//   const socketRef = useRef(null);
//   const location = useLocation();
//   const reactNavigator = useNavigate();
//   const { roomId } = useParams();
//   const codeRef = useRef();

//   const [clients, setClients] = useState([]);

//   useEffect(() => {
//     const init = async () => {
//       socketRef.current = await initSocket();
//       socketRef.current.on("connect_error", (err) => handleErrors(err));
//       socketRef.current.on("connect_failed", (err) => handleErrors(err));

//       function handleErrors(e) {
//         console.log("socket error", e);
//         toast.err("Socket connection failed, try again later.");
//         reactNavigator("/");
//       }

//       socketRef.current.emit(ACTIONS.JOIN, {
//         roomId,
//         username: location.state?.username,
//       });

//       // Listening for joined event
//       socketRef.current.on(
//         ACTIONS.JOINED,
//         ({ clients, username, socketId }) => {
//           if (username !== location.state?.username) {
//             toast.success(`${username} joined the room.`);
//             console.log(`${username} joined`);
//           }
//           setClients(clients);
//           socketRef.current.emit(ACTIONS.SYNC_CODE, {
//             code: codeRef.current,
//             socketId,
//           });
//         }
//       );
//       // Listening for disconnected
//       // socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
//       //   toast.success(`${username} left the room.`);
//       //   setClients((prev) => {
//       //     return prev.filter((client) => client.socketId !== socketId);
//       //   });
//       // });
//     };

//     init();

//     // return () => {
//     //   socketRef.current.disconnect();
//     //   socketRef.current.off(ACTIONS.JOINED);
//     //   socketRef.current.off(ACTIONS.DISCONNECTED);
//     // };
//   }, []);

//   function leaveRoom() {
//     reactNavigator("/");
//   }

//   async function copyRoomId() {
//     try {
//       await navigator.clipboard.writeText(roomId);
//       toast.success("Room ID copied to clipboard");
//     } catch (err) {
//       toast.error("Could not copy ROOM ID");
//       console.log(err);
//     }
//   }

//   if (!location.state) {
//     return <Navigate to="/" />;
//   }
//   <Navigate />;
//   return (
//     <div className="mainWrap">
//       <div className="aside">
//         <div className="asideInner">
//           <div className="logo">
//             <img
//               width={115}
//               className="logoImage"
//               src="/codespark.png"
//               alt="logo"
//             />
//           </div>
//           <h3>Connected Users 🟢</h3>

//           <div className="clientsList">
//             {clients.map((client) => (
//               <Client key={client.socketId} username={client.username} />
//             ))}
//           </div>
//         </div>

//         <button className="btn copyBtn" onClick={copyRoomId}>
//           Share ROOM-ID
//         </button>
//         <button className="btn leaveBtn" onclick={leaveRoom}>
//           Leave Room
//         </button>
//       </div>
//       <div className="editorWrap">
//         <Editor
//           socketRef={socketRef}
//           roomId={roomId}
//           onCodeChange={(code) => {
//             codeRef.current = code;
//           }}
//         />
//       </div>
//     </div>
//   );
// };

// export default EditorPage;

import React, { useEffect, useRef, useState, useCallback } from "react";
import Client from "../components/Client";
import Editor from "../components/Editor";
import DeleteApprovalModal from "../components/DeleteApprovalModal";
import { initSocket } from "../socket";
import ACTIONS from "../Actions";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import toast from "react-hot-toast";

const EditorPage = () => {
  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const codeRef = useRef();
  const lineAuthorsRef = useRef({});
  const setRemoteCodeFn = useRef(null);

  const [clients, setClients] = useState([]);

  // Deletion approval state
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [incomingDeleteRequest, setIncomingDeleteRequest] = useState(null);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState([]);

  // Line authorship state
  const [lineAuthors, setLineAuthors] = useState({});

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      // Listening for joined event
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
            console.log(`${username} joined`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
            lineAuthors: lineAuthorsRef.current,
          });
        }
      );

      // Listening for disconnected
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });

      // Listening for code sync (when a new user joins, they receive current code)
      socketRef.current.on(
        ACTIONS.SYNC_CODE,
        ({ code, lineAuthors: incomingAuthors }) => {
          if (code !== null && code !== undefined) {
            codeRef.current = code;
            // Use the remote code setter to properly mark as remote change
            if (setRemoteCodeFn.current) {
              setRemoteCodeFn.current(code);
            }
            // Update line authors if received
            if (incomingAuthors) {
              lineAuthorsRef.current = incomingAuthors;
              setLineAuthors(incomingAuthors);
            }
          }
        }
      );

      // Listening for real-time code changes from other users
      socketRef.current.on(
        ACTIONS.CODE_CHANGE,
        ({ code, username: changeAuthor, changedLines }) => {
          if (code !== null) {
            const currentCode = codeRef.current || "";
            if (currentCode !== code) {
              codeRef.current = code;
              // Use the remote code setter to properly mark as remote change
              if (setRemoteCodeFn.current) {
                setRemoteCodeFn.current(code);
              }

              // Update line authorship for changed lines
              if (changeAuthor && changedLines) {
                const newAuthors = { ...lineAuthorsRef.current };
                changedLines.forEach((lineNum) => {
                  newAuthors[lineNum] = changeAuthor;
                });
                lineAuthorsRef.current = newAuthors;
                setLineAuthors(newAuthors);
              }
            }
          }
        }
      );

      // Listening for deletion request from another user
      socketRef.current.on(
        ACTIONS.DELETE_REQUEST,
        ({ username, deletedCode, newCode, requestId, requesterId }) => {
          setIncomingDeleteRequest({
            username,
            deletedCode,
            newCode,
            requestId,
            requesterId,
          });
        }
      );

      // Listening for deletion approved
      socketRef.current.on(
        ACTIONS.DELETE_APPROVED,
        ({ requestId, newCode }) => {
          setPendingDeletion(null);
          setIncomingDeleteRequest(null);
          if (editorRef.current && newCode !== undefined) {
            editorRef.current.setValue(newCode);
            codeRef.current = newCode;
          }
          toast.success("Deletion approved!");
        }
      );

      // Listening for deletion rejected
      socketRef.current.on(
        ACTIONS.DELETE_REJECTED,
        ({ requestId, rejectedBy }) => {
          setPendingDeletion(null);
          toast.error(`${rejectedBy} rejected your deletion request.`);
        }
      );

      // Listening for deletion cancelled
      socketRef.current.on(ACTIONS.DELETE_CANCELLED, ({ requestId }) => {
        setIncomingDeleteRequest(null);
        toast("Deletion request was cancelled.", { icon: "ℹ️" });
      });

      // Listening for typing indicator
      socketRef.current.on(ACTIONS.TYPING, ({ username }) => {
        setTypingUsers((prev) => {
          if (!prev.includes(username)) {
            return [...prev, username];
          }
          return prev;
        });
      });

      // Listening for stop typing
      socketRef.current.on(ACTIONS.STOP_TYPING, ({ username }) => {
        setTypingUsers((prev) => prev.filter((u) => u !== username));
      });
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.SYNC_CODE);
        socketRef.current.off(ACTIONS.CODE_CHANGE);
        socketRef.current.off(ACTIONS.DELETE_REQUEST);
        socketRef.current.off(ACTIONS.DELETE_APPROVED);
        socketRef.current.off(ACTIONS.DELETE_REJECTED);
        socketRef.current.off(ACTIONS.DELETE_CANCELLED);
        socketRef.current.off(ACTIONS.TYPING);
        socketRef.current.off(ACTIONS.STOP_TYPING);
      }
    };
  }, [reactNavigator, location.state?.username, roomId]);

  // Handle deletion request from current user
  const handleDeletionRequest = useCallback(
    ({ deletedCode, newCode }) => {
      const requestId = Date.now().toString();
      setPendingDeletion({ deletedCode, newCode, requestId });

      socketRef.current.emit(ACTIONS.DELETE_REQUEST, {
        roomId,
        username: location.state?.username,
        deletedCode,
        newCode,
        requestId,
      });

      toast("Waiting for approval from other users...", { icon: "⏳" });
    },
    [roomId, location.state?.username]
  );

  // Handle approving an incoming deletion request
  const handleApproveDelete = useCallback(() => {
    if (incomingDeleteRequest) {
      socketRef.current.emit(ACTIONS.DELETE_APPROVED, {
        roomId,
        requestId: incomingDeleteRequest.requestId,
        newCode: incomingDeleteRequest.newCode,
        requesterId: incomingDeleteRequest.requesterId,
      });
      setIncomingDeleteRequest(null);
    }
  }, [incomingDeleteRequest, roomId]);

  // Handle rejecting an incoming deletion request
  const handleRejectDelete = useCallback(() => {
    if (incomingDeleteRequest) {
      socketRef.current.emit(ACTIONS.DELETE_REJECTED, {
        roomId,
        requestId: incomingDeleteRequest.requestId,
        username: location.state?.username,
        requesterId: incomingDeleteRequest.requesterId,
      });
      setIncomingDeleteRequest(null);
    }
  }, [incomingDeleteRequest, roomId, location.state?.username]);

  function leaveRoom() {
    reactNavigator("/");
  }

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID copied to clipboard");
    } catch (err) {
      toast.error("Could not copy ROOM ID");
      console.log(err);
    }
  }

  if (!location.state) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img
              width={115}
              className="logoImage"
              src="/codespark.png"
              alt="logo"
            />
          </div>
          <h3>Connected Users 🟢</h3>

          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>

        <button className="btn copyBtn" onClick={copyRoomId}>
          Share ROOM-ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>
      <div className="editorWrap">
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="typingIndicator">
            <span className="typingDot"></span>
            <span className="typingDot"></span>
            <span className="typingDot"></span>
            <span className="typingText">
              {typingUsers.map((u) => u.charAt(0).toUpperCase()).join(", ")}{" "}
              {typingUsers.length === 1 ? "is" : "are"} typing...
            </span>
          </div>
        )}
        <Editor
          socketRef={socketRef}
          editorRef={editorRef}
          roomId={roomId}
          clientsCount={clients.length}
          username={location.state?.username}
          pendingDeletion={pendingDeletion}
          onDeletionRequest={handleDeletionRequest}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
          lineAuthors={lineAuthors}
          onLineAuthorsChange={(authors) => {
            lineAuthorsRef.current = authors;
            setLineAuthors(authors);
          }}
          setRemoteCode={(fn) => {
            setRemoteCodeFn.current = fn;
          }}
        />
      </div>

      {/* Deletion approval modal */}
      <DeleteApprovalModal
        isOpen={!!incomingDeleteRequest}
        username={incomingDeleteRequest?.username}
        deletedCode={incomingDeleteRequest?.deletedCode}
        onApprove={handleApproveDelete}
        onReject={handleRejectDelete}
      />

      {/* Pending deletion indicator */}
      {pendingDeletion && (
        <div className="pendingDeletionBanner">
          ⏳ Waiting for approval to delete code...
          <button
            className="btn cancelBtn"
            onClick={() => {
              socketRef.current.emit(ACTIONS.DELETE_CANCELLED, {
                roomId,
                requestId: pendingDeletion.requestId,
              });
              setPendingDeletion(null);
              toast("Deletion cancelled.", { icon: "❌" });
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default EditorPage;

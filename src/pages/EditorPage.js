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

import React, { useEffect, useRef, useState } from "react";
import Client from "../components/Client";
import Editor from "../components/Editor";
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
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const codeRef = useRef();

  const [clients, setClients] = useState([]);

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
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
      }
    };
  }, [reactNavigator, location.state?.username, roomId]);

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
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
      </div>
    </div>
  );
};

export default EditorPage;

import { useState } from "react";

const VISIBLE_STATE_COPY = "Try again";
const DEAD_STATE_COPY = "Back";

export function RawStateFlow() {
  const [message, setMessage] = useState("");
  const [, setDeadMessage] = useState("");

  const updateMessages = () => {
    setMessage(VISIBLE_STATE_COPY);
    setDeadMessage(DEAD_STATE_COPY);
  };

  return <button onClick={updateMessages}>{message}</button>;
}

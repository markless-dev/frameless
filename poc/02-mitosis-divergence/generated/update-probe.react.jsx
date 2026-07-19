"use client";
import * as React from "react";
import { useState, useEffect } from "react";

function UpdateProbe(props) {
  const [count, setCount] = useState(() => 0);

  useEffect(() => {
    props.onProbe?.("update");
  });

  return (
    <section>
      <output data-testid="count">{count}</output>
      <button type="button" onClick={(event) => setCount(count + 1)}>
        Increment
      </button>
    </section>
  );
}

export default UpdateProbe;

import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function TestDatePicker() {
  const [date, setDate] = useState(null);
  return (
    <DatePicker
      selected={date}
      onChange={(d) => setDate(d)}
    />
  );
}


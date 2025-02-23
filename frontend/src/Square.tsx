import React, { useState } from "react";
import "./Square.css";

type SquareProps = {
  value: string;
  row: number;
  col: number;
  onClick: (row:number,col:number,value:string) => void;
};

export function Square({
  value,
  row,
  col,
  onClick
}: SquareProps) {

  return (
    <div
      className={
        value[0] !== "x"
          ? `${(row + col) % 2 === 1 ? "black" : "white"}-cell-container`
          : `danger-cell`
      }
      onClick={()=>{onClick(row,col,value)}}
    >
      {value[0] === "x" ? (
        <img
          className="chess-piece"
          src={`/pieces/${
            "rnbkqp".includes(value[1])
              ? `b${value[1].toLocaleUpperCase()}`
              : `w${value[1]}`
          }.svg`}
          alt={value[1]}
        />
      ) : value[0] === "." ? (
        <div className="possible-move"></div>
      ) : (
        value[0] !== " " && (
          <img
            className="chess-piece"
            src={`/pieces/${
              "rnbkqp".includes(value)
                ? `b${value.toLocaleUpperCase()}`
                : `w${value}`
            }.svg`}
            alt={value}
          />
        )
      )}
    </div>
  );
}

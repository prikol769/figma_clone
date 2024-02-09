"use client";

import { fabric } from "fabric";

import LeftSidebar from "@/components/LeftSidebar";
import Live from "@/components/Live";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import { useEffect, useRef, useState } from "react";
import {
  handleCanvasMouseDown,
  handleCanvasMouseUp,
  handleCanvasObjectModified,
  handleCanvasObjectScaling,
  handleCanvasSelectionCreated,
  handleCanvaseMouseMove,
  handlePathCreated,
  handleResize,
  initializeFabric,
  renderCanvas,
} from "@/lib/canvas";
import { ActiveElement, Attributes } from "@/types/type";
import { useMutation, useRedo, useStorage, useUndo } from "@/liveblocks.config";
import { defaultNavElement } from "@/constants";
import { handleDelete, handleKeyDown } from "@/lib/key-events";
import { handleImageUpload } from "@/lib/shapes";

export default function Page() {
  const undo = useUndo();
  const redo = useRedo();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawing = useRef(false);
  const shapeRef = useRef<fabric.Object | null>(null);
  const selectedShapeRef = useRef<string | null>(null);
  const activeObjectRef = useRef<fabric.Object | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isEditingRef = useRef(false);

  const canvasObjects = useStorage((root) => root.canvasObjects);
  const [activeElement, setActiveElement] = useState<ActiveElement>({
    name: "",
    value: "",
    icon: "",
  });

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: "",
    height: "",
    fontSize: "",
    fontFamily: "",
    fontWeight: "",
    fill: "#aabbcc",
    stroke: "#aabbcc",
  });

  const deleteAllShapes = useMutation(({ storage }) => {
    // get the canvasObjects store
    const canvasObjects = storage.get("canvasObjects");

    // if the store doesn't exist or is empty, return
    if (!canvasObjects || canvasObjects.size === 0) return true;

    // delete all the shapes from the store
    for (const [key, value] of canvasObjects.entries()) {
      canvasObjects.delete(key);
    }

    // return true if the store is empty
    return canvasObjects.size === 0;
  }, []);

  const deleteShapeFromStorage = useMutation(({ storage }, shapeId) => {
    /**
     * canvasObjects is a Map that contains all the shapes in the key-value.
     * Like a store. We can create multiple stores in liveblocks.
     *
     * delete: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.delete
     */
    const canvasObjects = storage.get("canvasObjects");
    canvasObjects.delete(shapeId);
  }, []);

  const handleActiveElement = (elem: ActiveElement) => {
    setActiveElement(elem);

    switch (elem?.value) {
      // delete all the shapes from the canvas
      case "reset":
        // clear the storage
        deleteAllShapes();
        // clear the canvas
        fabricRef.current?.clear();
        // set "select" as the active element
        setActiveElement(defaultNavElement);
        break;

      // delete the selected shape from the canvas
      case "delete":
        // delete it from the canvas
        handleDelete(fabricRef.current as any, deleteShapeFromStorage);
        // set "select" as the active element
        setActiveElement(defaultNavElement);
        break;

      case "image":
        imageInputRef.current?.click();
        isDrawing.current = false;

        if (fabricRef.current) {
          fabricRef.current.isDrawingMode = false;
        }

        break;

      default:
        // set the selected shape to the selected element
        selectedShapeRef.current = elem?.value as string;
        break;
    }
  };

  const syncShapeInStorage = useMutation(({ storage }, object) => {
    // if the passed object is null, return
    if (!object) return;
    const { objectId } = object;

    /**
     * Turn Fabric object (kclass) into JSON format so that we can store it in the
     * key-value store.
     */
    const shapeData = object.toJSON();
    shapeData.objectId = objectId;

    const canvasObjects = storage.get("canvasObjects");
    /**
     * set is a method provided by Liveblocks that allows you to set a value
     *
     * set: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.set
     */
    canvasObjects.set(objectId, shapeData);
  }, []);

  useEffect(() => {
    // initialize the fabric canvas
    const canvas = initializeFabric({
      canvasRef,
      fabricRef,
    });

    /**
     * listen to the mouse down event on the canvas which is fired when the
     * user clicks on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("mouse:down", (options) => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
      });
    });

    /**
     * listen to the mouse move event on the canvas which is fired when the
     * user moves the mouse on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("mouse:move", (options) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        selectedShapeRef,
        shapeRef,
        syncShapeInStorage,
      });
    });

    /**
     * listen to the mouse up event on the canvas which is fired when the
     * user releases the mouse on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("mouse:up", () => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        activeObjectRef,
        selectedShapeRef,
        syncShapeInStorage,
        setActiveElement,
      });
    });

    /**
     * listen to the object modified event on the canvas which is fired
     * when the user modifies an object on the canvas. Basically, when the
     * user changes the width, height, color etc properties/attributes of
     * the object or moves the object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("object:modified", (options) => {
      handleCanvasObjectModified({
        options,
        syncShapeInStorage,
      });
    });

    canvas.on("selection:created", (options) => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      });
    });

    canvas.on("object:scaling", (options) => {
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });
    });

    canvas.on("path:created", (options) => {
      handlePathCreated({
        options,
        syncShapeInStorage,
      });
    });

    /**
     * listen to the resize event on the window which is fired when the
     * user resizes the window.
     *
     * We're using this to resize the canvas when the user resizes the
     * window.
     */
    window.addEventListener("resize", () => {
      handleResize({
        canvas: fabricRef.current,
      });
    });

    window.addEventListener("keydown", (e) => {
      handleKeyDown({
        e,
        canvas: fabricRef.current,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });
    });

    // dispose the canvas and remove the event listeners when the component unmounts
    return () => {
      /**
       * dispose is a method provided by Fabric that allows you to dispose
       * the canvas. It clears the canvas and removes all the event
       * listeners
       *
       * dispose: http://fabricjs.com/docs/fabric.Canvas.html#dispose
       */
      canvas.dispose();

      // remove the event listeners
      window.removeEventListener("resize", () => {
        handleResize({
          canvas: null,
        });
      });

      window.removeEventListener("keydown", (e) =>
        handleKeyDown({
          e,
          canvas: fabricRef.current,
          undo,
          redo,
          syncShapeInStorage,
          deleteShapeFromStorage,
        })
      );
    };
  }, [canvasRef]); // run this effect only once when the component mounts and the canvasRef changes

  // render the canvas when the canvasObjects from live storage changes
  useEffect(() => {
    renderCanvas({
      fabricRef,
      canvasObjects,
      activeObjectRef,
    });
  }, [canvasObjects]);

  return (
    <div className="h-screen overflow-hidden">
      <Navbar
        imageInputRef={imageInputRef}
        handleImageUpload={(e: any) => {
          e.stopPropagation();

          handleImageUpload({
            file: e.target.files[0],
            canvas: fabricRef as any,
            shapeRef,
            syncShapeInStorage,
          });
        }}
        activeElement={activeElement}
        handleActiveElement={handleActiveElement}
      />

      <section className="flex h-full flex-row">
        <LeftSidebar allShapes={Array.from(canvasObjects)} />

        <Live canvasRef={canvasRef} undo={undo} redo={redo} />
        <RightSidebar
          elementAttributes={elementAttributes}
          setElementAttributes={setElementAttributes}
          fabricRef={fabricRef}
          isEditingRef={isEditingRef}
          activeObjectRef={activeObjectRef}
          syncShapeInStorage={syncShapeInStorage}
        />
      </section>
    </div>
  );
}

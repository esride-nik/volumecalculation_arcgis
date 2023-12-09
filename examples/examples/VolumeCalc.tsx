/* eslint-disable unicorn/numeric-separators-style */
/* eslint-disable unicorn/no-array-for-each */
import * as promiseUtils from '@arcgis/core/core/promiseUtils';
import Extent from '@arcgis/core/geometry/Extent';
import Mesh from '@arcgis/core/geometry/Mesh';
import Polygon from '@arcgis/core/geometry/Polygon';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import ImageryLayer from '@arcgis/core/layers/ImageryLayer';
import ImageryTileLayer from '@arcgis/core/layers/ImageryTileLayer';
import SceneView from '@arcgis/core/views/SceneView';
import Expand from '@arcgis/core/widgets/Expand';
import LayerList from '@arcgis/core/widgets/LayerList';
import Legend from '@arcgis/core/widgets/Legend';
import Search from '@arcgis/core/widgets/Search';
import { useMemo, useState } from 'react';

import { ArcSceneView, ArcUI, ArcWidget, useSceneView } from '../../src';
import { ArcGraphicsLayer } from '../../src/components/ArcLayer/generated/ArcGraphicsLayer';
import { ArcImageryTileLayer } from '../../src/components/ArcLayer/generated/ArcImageryTileLayer';

export default function VolumeCalc() {
  const [sceneView, setSceneView] = useState<SceneView>();

  const legend = useMemo(
    () =>
      new Expand({
        view: sceneView,
        content: new Legend({
          view: sceneView,
        }),
        expandTooltip: 'Legend',
        expanded: false,
      }),
    [sceneView]
  );

  const layerList = useMemo(
    () =>
      new Expand({
        view: sceneView,
        content: new LayerList({
          view: sceneView,
        }),
        expandTooltip: 'Search',
        expanded: false,
      }),
    [sceneView]
  );

  const search = useMemo(
    () =>
      new Search({
        view: sceneView,
      }),
    [sceneView]
  );

  return (
    <ArcSceneView
      map={{
        basemap: 'streets',
        ground: 'world-elevation',
        // ground: {
        //   navigationConstraint: 'none'
        // },
      }}
      // extent={{
      //   spatialReference: { wkid: 102_100 },
      //   xmin: -4_891_928.102_194_494,
      //   ymin: -2_307_356.023_380_755_4,
      //   xmax: -4_891_286.273_486_689,
      //   ymax: -2_306_865.213_192_433,
      // }}
      style={{ height: '100vh' }}
      // eventHandlers={{
      //   click: (e) => {
      //     console.log('click event', e.mapPoint);
      //   },
      // }}
      // viewingMode="local"
      // clippingArea={{
      //   spatialReference: { wkid: 102_100 },
      //   xmin: -4_891_786.441_670_591,
      //   ymin: -2_307_257.926_811_594,
      //   xmax: -4_891_427.934_010_591,
      //   ymax: -2_306_963.309_761_594_5,
      // }}
      onViewCreated={setSceneView}
    >
      <Layers />

      <ArcUI position="bottom-right">
        <ArcWidget widget={search} />
      </ArcUI>

      <ArcUI position="bottom-right">
        <ArcWidget widget={layerList} />
      </ArcUI>

      <ArcUI position="bottom-right">
        <ArcWidget widget={legend} />
      </ArcUI>
    </ArcSceneView>
  );
}

function Layers() {
  const sceneView = useSceneView();
  let imgLayer: ImageryLayer;
  let volGraphicsLayer: GraphicsLayer;

  const onVolGraphicsViewCreated = (e: any) => {
    console.log('onVolGraphicsViewCreated', e);
    volGraphicsLayer = e.layerView.layer as GraphicsLayer;

    // Define elevationInfo and set it on the layer
    const currentElevationInfo = {
      mode: 'relative-to-ground',
      // offset: -1200,
      // featureExpressionInfo: {
      //   expression: 'Geometry($feature).z * 0.5',
      // },
      unit: 'meters',
    } as unknown as __esri.GraphicsLayerElevationInfo;

    volGraphicsLayer.elevationInfo = currentElevationInfo;
  };

  const onImgViewCreated = (e: __esri.ImageryLayerLayerviewCreateEvent) => {
    imgLayer = e.layerView.layer as ImageryLayer;
    sceneView.goTo(imgLayer.fullExtent);
    console.log(
      'LayerView for imagery created!',
      imgLayer,
      imgLayer?.rasterInfo?.pixelSize?.x,
      imgLayer?.rasterInfo?.pixelSize?.y
    );

    imgLayer.renderer = {
      computeGamma: false,
      dra: false,
      gamma: [1],
      maxPercent: 0.25,
      minPercent: 0.25,
      max: 255,
      min: 0,
      statistics: [
        [
          1197.588_378_906_25, 1481.507_324_218_75, 1315.215_321_200_338_6,
          58.967_350_047_369_77,
        ],
      ],
      useGamma: false,
      stretchType: 'min-max',
      type: 'raster-stretch',
    };

    sceneView.on(['click'], (event: any) => {
      debouncedUpdate(event).catch((error: any) => {
        console.error(error);
        if (!promiseUtils.isAbortError(error)) {
          throw error;
        }
      });
    });

    /*
    We have continuous rows and columns of values, but as we're building triangles, we need to skip every 2nd value, offset from each other in consecutive rows.
        0.0   0.2   0.4   0.6   0.8 ...
           1.1   1.3   1.5   1.7...
        2.0   2.2   2.4 ...
           3.1   3.3   3.5 ...

    What we're building looks like:
    [0.0, 0.2, 1.1] [1.1, 1.3, 0.2]
    */
    const getTriangle = (
      allPoints: number[][][],
      yIndex: number,
      xIndex: number
    ): number[] => {
      // console.log(
      //   'getTriangle',
      //   `${yIndex}/${allPoints.length}`,
      //   `${xIndex}/${allPoints[0].length}`
      // );
      // const yIndex = index % 2;

      const triangle =
        yIndex % 2 == 0
          ? [
              ...allPoints[yIndex][xIndex],
              ...allPoints[yIndex][xIndex + 2],
              ...allPoints[yIndex + 1][xIndex + 1],
            ]
          : [
              ...allPoints[yIndex][xIndex + 1],
              ...allPoints[yIndex + 1][xIndex],
              ...allPoints[yIndex + 1][xIndex + 2],
            ];

      // const triangle =
      //   yIndex % 2 == 0
      //     ? [
      //         ...allPoints[yIndex][xIndex],
      //         ...allPoints[yIndex][xIndex + 2],
      //         ...allPoints[yIndex + 1][xIndex + 1],
      //       ]
      //     : [
      //         ...allPoints[yIndex][xIndex],
      //         ...allPoints[yIndex][xIndex + 2],
      //         ...allPoints[yIndex - 1][xIndex + 1],
      //       ];
      const indices =
        yIndex % 2 == 0
          ? [
              `${yIndex}.${xIndex}`,
              `${yIndex}.${xIndex + 2}`,
              `${yIndex + 1}.${xIndex + 1}`,
            ]
          : [
              `${yIndex}.${xIndex}`,
              `${yIndex}.${xIndex + 2}`,
              `${yIndex - 1}.${xIndex + 1}`,
            ];
      console.log(xIndex, indices.join(', '));
      return triangle;
    };

    const create3dMesh = (
      pixelData: __esri.PixelData,
      zValues: number[],
      symbolColor: string | __esri.Color,
      resolutionX: number,
      resolutionY: number
    ) => {
      const position: number[] = [];

      const allPoints: number[][][] = [];
      const zAdd = -1200;

      zValues.forEach((zValue: number, index: number): void => {
        const posY = Math.floor(index / pixelData.pixelBlock.height);
        if (!allPoints[posY]) allPoints[posY] = [];

        const posX = index % pixelData.pixelBlock.width;
        allPoints[posY][posX] = [
          pixelData.extent.xmin + posX,
          pixelData.extent.ymin + posY,
          zValue + zAdd,
        ];
      });
      // console.log('allPoints', allPoints);

      for (let y = 0; y < allPoints.length - 2; y++) {
        for (let x = 0; x < allPoints[0].length - 2; x += 2) {
          const t = getTriangle(allPoints, y, x);
          position.push(...t);
        }
      }
      // console.log('position', allPoints);

      // allPoints.forEach((allPointsY: number[][], y: number) => {
      //   if (y >= allPoints.length - 2) return;
      //   allPointsY.forEach((allPointsYX: number[], x: number) => {
      //     if (x >= allPointsY.length - 2) return;
      //     const t = getTriangle(allPoints, y, x);
      //     position.push(...t);
      //   });
      // });

      // // eslint-disable-next-line unicorn/no-array-for-each
      // zValues
      //   // eslint-disable-next-line unicorn/no-array-for-each
      //   .forEach((zValue: number, index: number): void => {
      //     const posX = index % pixelData.pixelBlock.width;
      //     const posY = Math.floor(index / pixelData.pixelBlock.height);
      //     position.push(
      //       pixelData.extent.xmin + posX,
      //       pixelData.extent.ymin + posY,
      //       zValue - 1200
      //     );
      //   });

      // console.log('position', position, position.length, position.length % 9);
      const posSliced = position.slice(
        0,
        position.length - (position.length % 9)
      );
      // console.log(
      //   'posSliced',
      //   posSliced,
      //   posSliced.length,
      //   posSliced.length % 9
      // );

      const g = new Graphic({
        geometry: new Mesh({
          spatialReference: pixelData.extent.spatialReference,
          vertexAttributes: {
            position: posSliced,
          },
        }),
        symbol: {
          type: 'mesh-3d',
          symbolLayers: [
            {
              type: 'fill',
              material: {
                color: symbolColor,
              },
              outline: { color: symbolColor },
              edges: {
                type: 'solid',
                color: [50, 50, 50, 0.5],
              },
            },
          ],
        } as unknown as __esri.MeshSymbol3D,
      });
      return [g];
    };

    const debouncedUpdate = promiseUtils.debounce(
      async (event: __esri.ViewClickEvent) => {
        // TODO: How to get data from [or into via AGP] RasterIdentifyResult.dataSeries https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-ImageryTileLayer.html#RasterIdentifyResult
        // TODO: Check the following flag to see if dataSeries is there: layer.rasterInfo.hasMultidimensionalTranspose (not documented!!) => https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-ImageryTileLayer.html#rasterInfo

        const mapPoint = event.mapPoint;

        // TODO: more that 158 return empty pixelBlock! :/
        const pixelBlockWidth = 20;
        const pixelBlockHeight = 20;
        const requestExtent = new Extent({
          xmin: mapPoint.x,
          ymin: mapPoint.y,
          xmax: mapPoint.x + pixelBlockWidth,
          ymax: mapPoint.y + pixelBlockHeight,
          spatialReference: { wkid: 102_100 },
        });

        // const requestExtent = new Extent({
        //   xmin: sceneView.extent.xmin,
        //   ymin: sceneView.extent.ymin,
        //   xmax: sceneView.extent.xmax,
        //   ymax: sceneView.extent.ymax,
        //   spatialReference: { wkid: 102_100 },
        // });

        const pixelData = (await (
          imgLayer as unknown as ImageryTileLayer
        ).fetchPixels(
          requestExtent,
          requestExtent.xmax - requestExtent.xmin,
          requestExtent.ymax - requestExtent.ymin
        )) as __esri.PixelData;

        const resolutionX = requestExtent.width / pixelData.pixelBlock.width;
        const resolutionY = requestExtent.height / pixelData.pixelBlock.height;

        // ImageryTileLayer will fetch pixels from nearest raster data source level based on the requested resolution.
        // Similarly, you can calculate the width and height needed for 0.6meter resolution.
        console.log('resolution', resolutionX, resolutionY);
        console.log('pixelData', pixelData);

        const volGraphics: Graphic[] = [];
        // const poly0 = create3dGraphics(
        const poly0 = create3dMesh(
          pixelData,
          pixelData.pixelBlock.pixels[0] as number[],
          '#FFD700',
          resolutionX,
          resolutionY
        );
        volGraphics.push(...poly0);

        // const poly1 = create3dGraphics(
        const poly1 = create3dMesh(
          pixelData,
          pixelData.pixelBlock.pixels[1] as number[],
          '#D700FF',
          resolutionX,
          resolutionY
        );
        volGraphics.push(...poly1);

        volGraphicsLayer.addMany(volGraphics);
      }
    );
  };

  const pixelFilterFunction = (pixelData: __esri.PixelData) => {
    if (pixelData == null || pixelData.pixelBlock == null) {
      return;
    }

    const currentMin = 0;
    const currentMax = 255;

    // The pixelBlock stores the values of all pixels visible in the view
    const pixelBlock = pixelData.pixelBlock;
    console.log(pixelData);
    // The pixels visible in the view
    const pixels = pixelBlock.pixels;
    let mask = pixelBlock.mask;

    console.log('pixelData', pixelBlock, pixels);

    // The number of pixels in the pixelBlock
    const numPixels = pixelBlock.width * pixelBlock.height;

    // Get the min and max values of the data in the current view
    const minVal = pixelData.pixelBlock.statistics[0].minValue ?? 0;
    const maxVal = pixelData.pixelBlock.statistics[0].maxValue;

    // Calculate the factor by which to determine the red and blue
    // values in the colorized version of the layer
    const factor = 255; //.0 / (maxVal - minVal);
    if (pixels == null) {
      return;
    }

    // Get the pixels containing temperature values in the only band of the data
    const tempBand = pixels[0];
    const p1 = pixels[0];
    // Create empty arrays for each of the RGB bands to set on the pixelBlock
    const rBand = new Uint8Array(p1.length);
    const gBand = new Uint8Array(p1.length);
    const bBand = new Uint8Array(p1.length);

    if (mask == null) {
      mask = new Uint8Array(p1.length); //mask = new Uint8Array(p1.length);
      mask.fill(1);
      pixelBlock.mask = mask;
    }

    // Loop through all the pixels in the view
    for (let i = 0; i < numPixels; i++) {
      // skip noData pixels
      if (mask[i] === 0) {
        continue;
      }
      const tempValue = tempBand[i];
      const red = (tempValue - minVal) * factor;
      mask[i] =
        p1[i] >= Math.floor(currentMin) && p1[i] <= Math.floor(currentMax)
          ? 1
          : 0;

      //apply color based on temperature value of each pixel
      if (mask[i]) {
        // p[i] = Math.floor((p1[i] - minVal) * factor);
        rBand[i] = red;
        gBand[i] = 0;
        bBand[i] = 255 - red;
      }
    }

    // Set the new pixel values on the pixelBlock
    pixelData.pixelBlock.pixels = [rBand, gBand, bBand]; //assign rgb values to each pixel
    pixelData.pixelBlock.statistics = [];
    pixelData.pixelBlock.pixelType = 'u8';
  };

  return (
    <>
      {/* <ArcImageryLayer
        layerProps={{
          url: 'https://iservices.arcgis.com/OLiydejKCZTGhvWg/arcgis/rest/services/VarzeadoLopesMineDemo_CVL_DRMINA_20180626_DSMDynamicImagery/ImageServer', // ImageryLayer
          opacity: 0.9,
          // TODO: pixelFilter only returns one band! why?
          // pixelFilter: pixelFilterFunction,
        }}
        eventHandlers={{ 'layerview-create': onImgViewCreated }}
      /> */}

      <ArcImageryTileLayer
        layerProps={{
          url: 'https://tiledimageservices.arcgis.com/OLiydejKCZTGhvWg/arcgis/rest/services/VarzeaMin_DOMs/ImageServer', // tiled ImageryLayer
          opacity: 0.9,
          // TODO: pixelFilter only returns one band! why?
          // pixelFilter: pixelFilterFunction,
        }}
        eventHandlers={{ 'layerview-create': onImgViewCreated }}
      />

      <ArcGraphicsLayer
        layerProps={{
          id: 'volumetricGraphics',
        }}
        eventHandlers={{ 'layerview-create': onVolGraphicsViewCreated }}
      />
    </>
  );
}

import * as promiseUtils from '@arcgis/core/core/promiseUtils';
import Extent from '@arcgis/core/geometry/Extent';
import ImageryTileLayer from '@arcgis/core/layers/ImageryTileLayer';
import RasterFunction from '@arcgis/core/layers/support/RasterFunction';
import Portal from '@arcgis/core/portal/Portal';
import {
  CalciteCard,
  CalciteLabel,
  CalciteSwitch,
} from '@esri/calcite-components-react';
import React from 'react';

import { ArcMapView, ArcUI, useMapView } from '../../src';
import { ArcImageryTileLayer } from '../../src/components/ArcLayer/generated/ArcImageryTileLayer';
import { ArcTileLayer } from '../../src/components/ArcLayer/generated/ArcTileLayer';

const portal = new Portal();
portal.authMode = 'auto';

const config = {
  streetsUrl:
    'https://server.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer',
  imgUrl:
    'https://tiledimageservices.arcgis.com/OLiydejKCZTGhvWg/arcgis/rest/services/VarzeaMine_DOMs_noData/ImageServer',
  // 'https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/New_York_Housing_Density/MapServer',
};

export default function Simple() {
  return (
    <ArcMapView
      map={{ basemap: 'oceans' }}
      center={[-118.805, 34.027]}
      zoom={7}
      style={{ height: '100vh' }}
      eventHandlers={{
        click: (e) => {
          console.log(e.mapPoint);
        },
      }}
    >
      <Layers />
    </ArcMapView>
  );
}

function Layers() {
  const mapView = useMapView();
  const [streetsVisible, setStreetsVisible] = React.useState(false);
  let layer: __esri.Layer;
  let layerView: __esri.LayerView;

  const onImgViewCreated = (e: __esri.TileLayerLayerviewCreateEvent) => {
    layer = e.layerView.layer;
    mapView.goTo(layer.fullExtent);
    console.log('LayerView for imagery created!', layer.title);

    // https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-ImageryTileLayer.html#rasterFunction
    const extractBand = new RasterFunction({
      functionName: 'ExtractBand',
      functionArguments: {
        bandIDs: [3, 2, 1],
      },
    });
    (layer as ImageryTileLayer).rasterFunction = extractBand;

    mapView.on(['pointer-move'], (event: any) => {
      // update mouse location graphic
      // graphic.geometry = view.toMap({ x: event.x, y: event.y });
      // debounce the imagerytilelayer.identify method from
      // pointer-move event to improve performance
      debouncedUpdate(event).catch((error: any) => {
        console.error(error);
        // if (!promiseUtils.isAbortError(error)) {
        //   throw error;
        // }
      });
    });

    const debouncedUpdate = promiseUtils.debounce(async (event: any) => {
      const point = mapView.toMap({ x: event.x, y: event.y });

      const fetchedPixels = await (layer as ImageryTileLayer).fetchPixels(
        new Extent({
          xmin: point.x,
          ymin: point.y,
          xmax: point.x + 10,
          ymax: point.y + 10,
        }),
        10,
        10
      );
      console.log('fetchedPixels', fetchedPixels);

      // get pixel values from the pointer location as user moves the
      // pointer over the image. Use pixel values from each band to
      // create a spectral chart. Also calculate the NDVI value for the location.
      return (layer as ImageryTileLayer)
        .identify(point)
        .then((results: any) => {
          console.log('RESULTS', results);

          // if (results.value) {
          //   document.querySelector('#instruction').style.display = 'none';
          //   // Update the spectral chart for the clicked location on the image
          //   spectralChart.data.datasets[0].data = [];
          //   spectralChart.data.datasets[0].data = results.value;
          //   spectralChart.update(0);
          //   if (chartDiv.style.display === 'none') {
          //     chartDiv.style.display = 'block';
          //   }
          //   document.querySelector(
          //     '#ndviValueDiv'
          //   ).innerHTML = `Processed NDVI value:  ${
          //     (results.processedValue - 100) / 100
          //   }`;
          // } else {
          //   document.querySelector('#instruction').style.display = 'block';
          //   chartDiv.style.display = 'none';
          //   document.querySelector('#ndviValueDiv').innerHTML = '';
          // }
        })
        .catch((error) => {
          if (!promiseUtils.isAbortError(error)) {
            throw error;
          }
        });
    });
  };

  const onStreetsViewCreated = (e: __esri.TileLayerLayerviewCreateEvent) => {
    console.log('LayerView for streets created!', e.layerView.layer.title);
  };

  return (
    <>
      <ArcUI position="top-right">
        <CalciteCard>
          <CalciteLabel layout="inline" style={{ height: 0, padding: 5 }}>
            <CalciteSwitch
              checked={streetsVisible ? true : undefined}
              onCalciteSwitchChange={(e) => setStreetsVisible(e.target.checked)}
            />
            Transportation
          </CalciteLabel>
        </CalciteCard>
      </ArcUI>

      {/* Streets Layer */}
      <ArcTileLayer
        layerProps={{ url: config.streetsUrl, visible: streetsVisible }}
        eventHandlers={{ 'layerview-create': onStreetsViewCreated }}
      />

      {/* Image Layer */}
      <ArcImageryTileLayer
        layerProps={{ url: config.imgUrl, opacity: 0.9 }}
        eventHandlers={{ 'layerview-create': onImgViewCreated }}
      />
    </>
  );
}

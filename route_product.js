const map = L.map('map');
const configElement = document.getElementById('map');
const targetRouteNo = parseInt(configElement.dataset.routeNo, 10);


L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html'>地理院タイル</a>",
    maxZoom: 18,
}).addTo(map);

const infoDiv = document.getElementById('info');
let highlightLayer = null;
let allFeatures = [];
const geojsonLayers = []; // ← 複数レイヤーを保持

function generateInfoHTML(feature, duplicates = []) {
    const props = feature.properties;
    let html = `<strong>属性情報:</strong><br><table class="design01">`;
    html += `<tr><td>道路の種類</td><td>${props.route_type}</td></tr>`;
    html += `<tr><td>路線名</td><td>${props.route_name}</td></tr>`;

    const isTollRoad = props.toll_road === 1;
    const hasNickName = props.nick_name && props.nick_name.toUpperCase() !== "NULL";
    const isDGH_Route = props.DGH_Route === 1;

    if (!isTollRoad && hasNickName) {
        html += `<tr><td>通称名</td><td>${props.nick_name}</td></tr>`;
    }

    if (isTollRoad && hasNickName) {
        html += `<tr><td>有料道路名</td><td>${props.nick_name}</td></tr>`;
    }

    html += `<tr><td colspan="2">${isDGH_Route ? '直管国道' : '補助国道'}</td></tr>`;

    if (duplicates.length > 1) {
        const others = duplicates.filter(f => f !== feature);
        const links = others.map(f => {
            const name = f.properties.route_name;
            const no = f.properties.Rd_SortNo;
            return `<a href="Route${no}.html" target="_blank">${name}</a>`;
        }).join('<br>');
        html += `<tr><td>重複路線</td><td>${links}</td></tr>`;
    }

    html += `</table>`;
    return html;
}

function highlightRoutes(feature) {
    if (highlightLayer) {
        geojsonLayers.forEach(layerGroup => {
            layerGroup.resetStyle(highlightLayer);
        });
    }

    geojsonLayers.forEach(layerGroup => {
        layerGroup.eachLayer(layer => {
            if (layer.feature === feature) {
                highlightLayer = layer;
                layer.setStyle({ color: 'cyan', weight: 5 });
                layer.bringToFront();
            }
        });
    });
}

fetch('route.geojson')
    .then(res => res.json())
    .then(data => {
        allFeatures = data.features;
        const filteredFeatures = allFeatures.filter(f => f.properties.Rd_SortNo === targetRouteNo);

        const featuresByPriority = {
            5: [], // 補助国道
            4: [], // 直管国道
            3: [], // 補助有料道路
            2: [], // 直管有料道路
        };

        filteredFeatures.forEach(f => {
            const isToll = f.properties.toll_road === 1;
            const isDGH = f.properties.DGH_Route === 1;

            if (isToll && isDGH) {
                featuresByPriority[2].push(f);
            } else if (isToll) {
                featuresByPriority[3].push(f);
            } else if (isDGH) {
                featuresByPriority[4].push(f);
            } else {
                featuresByPriority[5].push(f);
            }
        });

        function getStyle(feature) {
            const isToll = feature.properties.toll_road === 1;
            const isDGH = feature.properties.DGH_Route === 1;

            if (isToll && isDGH) return { color: '#633F98', weight: 4 };
            if (isToll) return { color: '#B17CFF', weight: 3 };
            if (isDGH) return { color: '#EC1B24', weight: 3 };
            return { color: '#EA86B7', weight: 2 };
        }

        [5, 4, 3, 2].forEach(priority => {
            const layerGroup = L.geoJSON({ type: "FeatureCollection", features: featuresByPriority[priority] }, {
                style: getStyle,
                onEachFeature: (feature, layer) => {
                    layer.on('click', () => {
                        const clickedCoords = JSON.stringify(feature.geometry.coordinates);
                        const sameRouteFeatures = allFeatures.filter(f =>
                            JSON.stringify(f.geometry.coordinates) === clickedCoords
                        );
                        const html = generateInfoHTML(feature, sameRouteFeatures);
                        infoDiv.innerHTML = html;
                        highlightRoutes(feature);
                    });
                }
            }).addTo(map);

            geojsonLayers.push(layerGroup);
        });

        // 全体の表示範囲を調整
        const allBounds = L.featureGroup(geojsonLayers).getBounds();
        map.fitBounds(allBounds);
    });
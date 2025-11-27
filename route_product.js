
const map = L.map('map');
const configElement = document.getElementById('map');
const targetRouteNo = parseInt(configElement.dataset.routeNo, 10);


// ページ読み込み時に初期状態を保持
const initialInfoElement = document.querySelector('#info').cloneNode(true);

L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html'>地理院タイル</a>",
    maxZoom: 18,
}).addTo(map);

const infoDiv = document.getElementById('info');
let highlightLayer = null;
let allFeatures = [];
const geojsonLayers = [];

// ----------------------
// スタイル生成関数
// ----------------------
function getStyles(feature) {
    const props = feature.properties;
    const isToll = props.toll_road === 1;
    const isDGH = props.DGH_Route === 1;
    const isExpwy = props.expwy === 1;

    // 基本スタイル
    let baseStyle;
    if (isToll && isDGH) baseStyle = { color: '#633F98', weight: 4 };
    else if (isToll) baseStyle = { color: '#B17CFF', weight: 3 };
    else if (isDGH) baseStyle = { color: '#EC1B24', weight: 3 };
    else baseStyle = { color: '#EA86B7', weight: 3 };

    // expwyなら輪郭線追加
    if (isExpwy) {
        const outlineWeight = (props.DGH_Route === 1) ? 6 : 4;
        return [
            { color: 'black', weight: outlineWeight }, // 輪郭線
            baseStyle // 元の色
        ];
    }
    return [baseStyle];
}

// ----------------------
// 情報HTML生成
// ----------------------

function generateInfoHTML(feature, duplicates = []) {
    const props = feature.properties;
    const container = document.createElement('div');
    container.style.position = 'relative'; // ボタン位置を正しくするため

    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';

    Object.assign(closeButton.style, {
        position: 'absolute',
        top: '-1px',  // 少し余白を増やす
        right: '-1px',
        border: 'none',
        background: 'transparent',
        fontSize: '20px', // 見やすく
        fontWeight: 'bold',
        cursor: 'pointer'
    });






    closeButton.addEventListener('click', () => {
        // infoDivを完全にクリア（初期状態に戻す＝空にする）
        infoDiv.innerHTML = '<strong>属性情報</strong>';
    });

    container.appendChild(closeButton);

    // 属性情報HTMLを生成
    let html = `<strong>属性情報:</strong><br><table class="design01">`;
    html += `<tr><td>道路の種類</td><td>${props.route_type}</td></tr>`;
    html += `<tr><td>路線名</td><td>${props.route_name}</td></tr>`;
    if (props.expwy === 1) {
        html += `<tr><td colspan="2" bgcolor="#007356"><div style="display: flex; align-items: center;"><span><img src="pic/expwy.png" style="width: 32px; height: auto; "></span><span style="color: #FFFFFF; display: flex; flex-direction: column; justify-content: center; text-align: center; margin-left: 8px;"><strong style="font-size: 18px; letter-spacing: 2px;">自動車専用道路</strong><span style="font-family: sans-serif; font-size: 14px;">EXCLUSIVE CAR ROAD</span></span></div></td></tr>`;
    }
    if (props.nick_name && props.nick_name.toUpperCase() !== "NULL") {
        html += `<tr><td>${props.toll_road === 1 ? '有料道路名' : '通称名'}</td><td>${props.nick_name}</td></tr>`;
    }
    html += `<tr><td colspan="2">${props.DGH_Route === 1 ? '直管国道' : '補助国道'}</td></tr>`;
    html += `<tr><td>区間延長※</td><td>${props.length} m</td></tr>`;
    if (duplicates.length > 1) {
        const others = duplicates.filter(f => f !== feature);
        const links = others.map(f => `<a href="Route${f.properties.Rd_SortNo}.html">${f.properties.route_name}</a>`).join('<br>');
        html += `<tr><td>重複路線</td><td>${links}</td></tr>`;
    }
    html += `</table>`;

    // HTMLを container に追加
    const infoContent = document.createElement('div');
    infoContent.innerHTML = html;
    container.appendChild(infoContent);

    return container; // outerHTMLではなくDOM要素を返す
}


// ----------------------
// クリックイベント付与
// ----------------------
function attachClickEvent(layer, feature) {
    layer.on('click', () => {
        const clickedCoords = JSON.stringify(feature.geometry.coordinates);
        const sameRouteFeatures = allFeatures.filter(f =>
            JSON.stringify(f.geometry.coordinates) === clickedCoords
        );
        const htmlElement = generateInfoHTML(feature, sameRouteFeatures);
        infoDiv.innerHTML = ''; // 古い要素を完全に削除
        infoDiv.appendChild(htmlElement);
        highlightRoutes(feature);
    });
}

// ----------------------
// ハイライト処理
// ----------------------


function highlightRoutes(feature) {
    // ハイライト解除（簡潔版）
    if (highlightLayer) {
        geojsonLayers.forEach(layerGroup => {
            layerGroup.eachLayer(layer => layerGroup.resetStyle(layer));
        });
    }

    // 新しいハイライト適用（黒輪郭線は無視）
    geojsonLayers.forEach(layerGroup => {
        layerGroup.eachLayer(layer => {
            if (layer.feature === feature) {
                highlightLayer = layer;
                layer.setStyle({ color: 'cyan', weight: 5 });

                // bringToFrontは黒輪郭線には適用しない
                if (layer.options.style.color !== 'black') {
                    layer.bringToFront();
                }
            }
        });
    });
}

// ----------------------
// レイヤー生成
// ----------------------


function createFeatureLayers(features) {
    const outlineLayers = [];
    const colorLayers = [];

    // featureごとにスタイルを分けて格納
    features.forEach(feature => {
        const styles = getStyles(feature);
        if (styles.length > 1) {
            outlineLayers.push(L.geoJSON(feature, { style: styles[0] })); // 輪郭線
            colorLayers.push(L.geoJSON(feature, { style: styles[1] }));   // 色付き
        } else {
            colorLayers.push(L.geoJSON(feature, { style: styles[0] }));
        }
    });

    // まず輪郭線を全て追加（背景）
    outlineLayers.forEach(layer => {
        layer.addTo(map);
        geojsonLayers.push(layer);
    });

    // 次に色付きレイヤーを追加（前面）
    colorLayers.forEach(layer => {
        layer.addTo(map);
        geojsonLayers.push(layer);

        // イベントは色付きレイヤーのみ
        layer.eachLayer(l => attachClickEvent(l, l.feature));
    });
}

// ----------------------
// データ読み込み
// ----------------------
fetch('route.geojson')
    .then(res => res.json())
    .then(data => {
        allFeatures = data.features;
        const filteredFeatures = allFeatures.filter(f => f.properties.Rd_SortNo === targetRouteNo);

        const featuresByPriority = { 5: [], 4: [], 3: [], 2: [] };

        filteredFeatures.forEach(f => {
            const isToll = f.properties.toll_road === 1;
            const isDGH = f.properties.DGH_Route === 1;
            if (isToll && isDGH) featuresByPriority[2].push(f);
            else if (isToll) featuresByPriority[3].push(f);
            else if (isDGH) featuresByPriority[4].push(f);
            else featuresByPriority[5].push(f);
        });

        [5, 4, 3, 2].forEach(priority => createFeatureLayers(featuresByPriority[priority]));

        const allBounds = L.featureGroup(geojsonLayers).getBounds();
        map.fitBounds(allBounds);
    });






let lastWidth = window.innerWidth;
let resizeTimer;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // 幅が変わったときだけ処理（高さ変化は無視）
        if (window.innerWidth !== lastWidth) {
            lastWidth = window.innerWidth;

            const headerHeight = document.querySelector('header')?.offsetHeight || 50;

            if (window.matchMedia('(max-width: 768px)').matches) {
                // PC → .content補正
                const scrollContainer = document.querySelector('.content');
                scrollContainer.scrollBy(0, -headerHeight);
            } else {
                // モバイル → 全体スクロール補正
                window.scrollBy(0, -headerHeight);
            }

            // 地図も補正
            const mapContainer = document.querySelector('#map');
            if (mapContainer) {
                mapContainer.scrollIntoView({ block: 'start' });
            }
        }
    }, 200); // 200ms デバウンス
});

const id = Math.floor(Math.random() * 1000);

console.log(id);

let pclist = {};
let dclist = {};
let posList = {};

const ws = new WebSocket('wss://cloud.achex.ca');
ws.onopen = () => {
    console.log('ws open');
    const auth = {auth: 'default@890', passowrd: '19861012'};
    ws.send(JSON.stringify(auth));
};
ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.id && data.id !== id) {
        console.log(ev, data);
        const pc = pclist[data.id] || makePc(data.id);
        if (data.offer) {
            const offer = new RTCSessionDescription({
                type: 'offer',
                sdp: data.offer
            });
            (async () => {
                await pc.setRemoteDescription(offer);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                const json = {id, answer, toId: data.id, to: 'default@890'};
                ws.send(JSON.stringify(json));
            })();
        }
        if (data.candidate) {
            const candidate = new RTCIceCandidate({
                candidate: data.candidate.candidate,
                sdpMLineIndex: data.candidate.sdpMLineIndex,
                sdpMid: data.candidate.sdpMid
            });
            (async () => {
                await pc.addIceCandidate(candidate);
            })();
        }
    }
};

function makePc(tgtId) {
    const pc = new RTCPeerConnection({
        iceServers: [{urls: 'stun:stun.services.mozilla.com:3478'}]
    });
    pc.onicecandidate = (ev) => {
        console.log(ev);
        if (ev.candidate) {
            const sdp = pc.localDescription.sdp;
            const json = {id, toId: tgtId, candidate: ev.candidate, sdp, to: 'default@890'};
            ws.send(JSON.stringify(json));
        }
    };
    pc.onicegatheringstatechange = (ev) => {
        console.log(ev.currentTarget.iceGatheringState)
    };
    pc.ondatachannel = (ev) => {
        console.log(ev);
        const dc = ev.channel;
        dc.onopen = onDcOpenHandler;
        dc.onmessage = onDcMessageHandler;
        dclist[tgtId] = dc;
    };
    pclist[tgtId] = pc;
    return pc;
}

const onDcOpenHandler = (ev) => {
    console.log(ev);
};

const onDcMessageHandler = (ev) => {
    console.log(ev);
    const data = JSON.parse(ev.data);
    if (data.pos) {
        if (data.pos.x === null || data.pos.y === null) {
            ctx.beginPath();
            let posls = posList[data.id];
            let before = {x: null, y: null};
            posls.forEach(e => {
                before = draw(before.x, before.y, e.x, e.y);
            });
            ctx.closePath();
            posList[data.id] = [];
        } else {
            let pos = posList[data.id] || [];
            pos.push(data.pos);
            posList[data.id] = pos;
        }
        const json = {id: data.id, pos: data.pos};
        const str = JSON.stringify(json);
        for (let key in dclist) {
            const dc = dclist[key];
            dc.send(str);
        }
    }
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const currentColor = '#000000';
let click = false;
let beforePos = {x: null, y: null};
canvas.onmousedown = (ev) => {
    console.log(ev);
    click = true;
    ctx.beginPath();
};
canvas.onmousemove = (ev) => {
    if (click) {
        console.log(ev);
        const x = ev.clientX;
        const y = ev.clientY;
        beforePos = draw(beforePos.x, beforePos.y, x, y);
        const json = {id, pos: {x, y}};
        const str = JSON.stringify(json);
        for (let key in dclist) {
            const dc = dclist[key];
            dc.send(str);
        }
    }
};
canvas.onmouseup = (ev) => {
    console.log(ev);
    ctx.closePath();
    click = false;
    beforePos = {x: null, y: null};
    const json = {id, pos: {x: null, y: null}};
    const str = JSON.stringify(json);
    for (let key in dclist) {
        const dc = dclist[key];
        dc.send(str);
    }
};

const draw = (beforeX, beforeY, x, y) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = currentColor;
    ctx.moveTo(beforeX || x, beforeY || y);
    ctx.lineTo(x, y);
    ctx.stroke();
    return {x, y};
};
let idmk = {
    confday: (day => "conference-day-" + day),
    daylink: (day => "link-day-" + day),
    talk: (i => "t" + i)
};


function clickDayLink(llist, i) {
    let l = llist[i];
    let currentday = +l.id.replace(idmk.daylink(""), "");
    e = document.getElementById(idmk.confday(currentday));
    e.style.display = "inherit";
    l.setAttribute("selected", '1');

    Array.from(e.getElementsByClassName("current-time-rule")).forEach(e => (e.style.display = "inherit"));

    for (let day = 0; day < llist.length; day++) {
        if (day !== currentday) {
            e = document.getElementById(idmk.confday(day));
            e.style.display = "none";
            llist[day].removeAttribute("selected");
            Array.from(e.getElementsByClassName("current-time-rule")).forEach(e => (e.style.display = "none"));
        }
    }
}


function storeSelectionInCurrentUrl(field, s) {
    let oldloc = window.location.href;
    let u = new URL(oldloc);
    if (!s) {
        u.searchParams.delete(field);
    } else {
        u.searchParams.set(field, s);
    }
    history.pushState({}, oldloc, u.href);
}


// the only one that works
// https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string/36046727#36046727
// (what about a saner base64 in stdlib? oh, we don't have one..)
function uint8toBase64(u8) {
        return btoa(String.fromCharCode.apply(null, u8));
}

function base64toUint8(str) {
        return atob(str).split('').map(c => c.charCodeAt(0));
}

const BitSetData = {};
BitSetData.from = {
    number: (len) => [len, new Uint8Array(Math.ceil(len/8))],
    array: (a) => {
        let data = new Uint8Array(a);
        return [data.length * 8, data];
    },
    string: (s) => {
        let data = new Uint8Array(s.split(","));
        return [data.length * 8, data];
    },
    base64string: (s) => {
        let data = new Uint8Array(base64toUint8(s));
        return [data.length * 8, data];
    }
};

function BitSet(o, initmethod) {
    let bitset, len;
    initmethod = initmethod || BitSetData.from.number;
    if (([len, bitset] = initmethod(o)) === undefined) {
        throw new Error("unrecognised method to conjure a bitset from");
    }
    funcs = { // a bit shorter
        isEmpty: () => bitset.reduce((a, c) => a + c, 0) == 0,
        add: (i) => (bitset[Math.floor(i/8)] |= 1 << (i % 8)),
        toggle: (i) => (bitset[Math.floor(i/8)] ^= 1 << (i % 8)),
        forEach: function (cb) {
            for (let i = 0; i < len; i++) {
                if ((bitset[Math.floor(i/8)] & (1 << (i % 8))) > 0) { cb(i); }
            }
        },
        toString: () => bitset.join(","),
        toBase64: () => {
            return uint8toBase64(bitset);
        }
    };
    Object.keys(funcs).forEach(key => this[key] = funcs[key]);
}

function compressBase64String(s) {
    return s.replace(/(.)\1{4,}/g, function (match, p1) {
        return `*${p1}${match.length}*`;
    });
}

function decompressBase64String(s) {
    return s.replace(/\*(.)([0-9]+)\*/g, function (match, p1, p2) {
        return p1.repeat(+p2);
    });
}

function svgQR(url) {
}

function PageUIAction(icon, callbacks) {
    let it = document.createElement("button");
    it.classList.add("action");
    it.innerHTML = `<svg><use xlink:href="#${icon}"/></svg>`;
    Object.keys(callbacks).forEach(k => it.addEventListener(k, callbacks[k]));
    this.element = it;
}

function parseTime(s) {
    // whyyyyy js is so bad....
    let cd = new Date(Date.now());
    return new Date(`${cd.toISOString().split("T")[0]}T${s}`);
}

// on page load
(function () {

    let talkEventListeners = {};

    let modalwindow = document.getElementById("modal"); 
    let modalcontent = document.getElementById("modal-content"); 

    modalwindow.addEventListener("click", () => {modalwindow.removeAttribute("active")});
    
    let UI = document.getElementById("tt-actions"); 

    share = new PageUIAction("arrow", {
        click: function () {
            storeSelectionInCurrentUrl(
                "sel",
                compressBase64String(selectedTalks.toBase64())
            );
            disableEditing();
        }
    });

    let qr = new PageUIAction("qr", {
        click: function () {
            if (modalwindow.getAttribute("active") == 1) {
                modalwindow.removeAttribute("active")
            } else {
                modalwindow.setAttribute("active", 1)
                let size = Math.min(modalwindow.clientWidth, modalwindow.clientHeight);
                console.log(modalcontent.clientWidth);
                console.log(modalcontent.clientHeight);
                let qrcode = new QRCode({
                    content: window.location.href,
                    padding: 4,
                    width: size,
                    height: size
                });
                modalcontent.innerHTML = qrcode.svg()
            }
        }
    });
    UI.appendChild(qr.element);

    let allTalks = Array.from(document.getElementsByClassName("talk")); 
    const ntalks = allTalks.length;
    let selectedTalks;
    
    function updateSelectedTalks() {
        let url = new URL(window.location.href);
        let selectionString = url.searchParams.get("sel");
        
        if (selectionString !== null) {
            let decompressed = decompressBase64String(selectionString);
            selectedTalks = new BitSet(decompressed, BitSetData.from.base64string);
            disableEditing();
        } else {
            const storedSelection = localStorage.getItem("sel");
            if (!storedSelection) {
                selectedTalks = new BitSet(ntalks);    
            } else {
                selectedTalks = new BitSet(storedSelection, BitSetData.from.string);
            }
            enableEditing();
        }
        selectedTalks.forEach(i => (
            document.getElementById(idmk.talk(i)).setAttribute("active", "1"))
        );
    }

    window.addEventListener('popstate', updateSelectedTalks);
    updateSelectedTalks(); // on page load

    
    function selectTalkAction(t) {
        return function () {
            let talkn = +t.id.replace(idmk.talk(""),"");
            if (t.getAttribute("active") == 1) {
                t.removeAttribute("active");
            } else {
                t.setAttribute("active", "1");
            }
            selectedTalks.toggle(talkn);
            localStorage.setItem("sel", selectedTalks.toString());
        }
    }

    function enableEditing() {
        // to prevent attaching multiple event listeners
        if (!UI.getAttribute("active")) { 
            UI.setAttribute("active", "1");
            allTalks.forEach(t => {
                action = selectTalkAction(t);
                talkEventListeners[t.id] = action;
                t.addEventListener("click", action)
            });
        }
    }

    function disableEditing() {
        UI.removeAttribute("active");
        allTalks.forEach(
            t => t.removeEventListener("click", talkEventListeners[t.id])
        );
    }


    let timeslots = document.querySelectorAll(".schedule .time-slot");
    let first_time = parseTime(timeslots[0].innerHTML);
    let last_time = parseTime(timeslots[timeslots.length - 1].innerHTML);

    function update_time_line() {
        let cd = new Date(Date.now());
        let min = cd.getMinutes(),
            minresidue = cd.getMinutes() % 10,
            sec = Math.floor(cd.getSeconds() / 6);
        let timepart = Intl.NumberFormat("en-US", {
            minimumIntegerDigits: 2
        });

        let minutes_rough = min - minresidue;
        
        Array.from(document.getElementsByClassName("current-time-rule")).forEach(
            e => {e.style.display = "none";}
        );
        
        if ((min > last_time.getMinutes() && cd.getHours() == last_time.getHours())
            ||
            (cd.getHours() > last_time.getHours())
            || 
            (cd.getHours() < first_time.getHours())
            || 
            (min < first_time.getMinutes() && cd.getHours() == first_time.getHours())) {
            return;
        }

        let new_props = {
            "display": 'inherit',
            "grid-row": `time-${timepart.format(cd.getHours())}${timepart.format(minutes_rough)}`,
            "top": `${(minresidue*10 + sec)}%`
        };
        
    
        let current_time_line = document.querySelector(
            `.conference-anyday[data-date="${cd.toISOString().split("T")[0]}"] .current-time-rule`
        );
        Object.keys(new_props).forEach((k, i) => {
            current_time_line.style[k] = new_props[k];
        });
    }
    
    update_time_line();
    setInterval(update_time_line, 1000);

}) ();



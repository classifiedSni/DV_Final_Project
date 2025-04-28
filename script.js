
const map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 8 }).addTo(map);

// Load Earthquake Data
d3.csv("Final_Earthquake_Cleaned_Dataset.csv").then(function(data) {
    // Data Preprocessing
    data.forEach(d => {
        d.Year = +d.Year;
        d.latitude = +d.latitude;
        d.longitude = +d.longitude;
        d.mag = +d.mag;
        d.depth = +d.depth;
    });
    const slider = document.getElementById('yearSlider');
    const yearLabel = document.getElementById('selectedYear');
    const markersGroup = L.layerGroup().addTo(map);

    function getColor(mag) {
        if (mag < 4) return 'green';
        else if (mag < 7) return 'blue';
        return 'red';
    }

    function updateMap(year) {
        markersGroup.clearLayers();
        data.filter(d => d.Year === year).forEach(d => {
            L.circleMarker([d.latitude, d.longitude], {
                radius: d.mag,
                color: getColor(d.mag),
                fillOpacity: 0.5
            }).bindPopup(`<b>${d.place}</b><br>Magnitude: ${d.mag}<br>Depth: ${d.depth} km<br>Year: ${d.Year}`)
              .addTo(markersGroup);
        });
    }

    updateMap(+slider.value);

    slider.addEventListener('input', function() {
        yearLabel.textContent = this.value;
        updateMap(+this.value);
    });

    //Heatmap
    const heatMap = L.map('heatmap').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 6 }).addTo(heatMap);

    const heatData = data.map(d => [d.latitude, d.longitude, d.mag / 10]);

    L.heatLayer(heatData, {
        radius: 8,
        blur: 12,
        minOpacity: 0.4
    }).addTo(heatMap);

    //Bar Graph
    
    const lowCount = data.filter(d => d.mag < 4).length;
    const strongCount = data.filter(d => d.mag >= 4 && d.mag < 7).length;
    const destructiveCount = data.filter(d => d.mag >= 7).length;

    const ctx = document.getElementById('barGraphCanvas').getContext('2d');

    const barConfig = {
        type: 'bar',
        data: {
            labels: ['Low', 'Strong', 'Destructive'],
            datasets: [{
                label: 'Number of Earthquakes',
                data: [lowCount, strongCount, destructiveCount],
                backgroundColor: ['#2ecc71', '#3498db', '#e74c3c']
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 2000 },
            scales: { y: { beginAtZero: true } }
        }
    };

    let barChartInitialized = false;

    window.addEventListener('scroll', () => {
        const barSection = document.getElementById('bargraph-section');
        if (!barChartInitialized && barSection.getBoundingClientRect().top < window.innerHeight / 1.3) {
            new Chart(ctx, barConfig);
            barChartInitialized = true;
        }
    });

    //Bubble Chart
    const bubbleWidth = 900, bubbleHeight = 600;

    const svg = d3.select("#d3-bubble-chart")
                  .append("svg")
                  .attr("width", bubbleWidth)
                  .attr("height", bubbleHeight);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    const top15 = data.sort((a, b) => b.mag - a.mag).slice(0, 15);

    const color = d3.scaleOrdinal(d3.schemeCategory10.concat(d3.schemeSet3)).domain(d3.range(15));
    const sizeScale = d3.scaleLinear()
                        .domain([d3.min(top15, d => d.mag), d3.max(top15, d => d.mag)])
                        .range([30, 100]);

    const nodes = top15.map((d, i) => ({
        radius: sizeScale(d.mag),
        place: d.place,
        mag: d.mag,
        depth: d.depth,
        year: d.Year,
        color: color(i)
    }));

    const simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(5))
        .force("center", d3.forceCenter(bubbleWidth / 2, bubbleHeight / 2))
        .force("collision", d3.forceCollide().radius(d => d.radius + 5))
        .on("tick", ticked);

    const bubbles = svg.selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(300).attr("r", d.radius * 1.1);
            tooltip.transition().style("opacity", 1);
            tooltip.html(`<strong>${d.place}</strong><br>Mag: ${d.mag}<br>Depth: ${d.depth} km<br>Year: ${d.year}`)
                   .style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 30) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this).transition().duration(300).attr("r", d.radius);
            tooltip.transition().style("opacity", 0);
        });

    function ticked() {
        bubbles.attr("cx", d => d.x)
               .attr("cy", d => d.y);
    }

    //Pi Chart
    const causeCounts = d3.rollup(data, v => v.length, d => d.type);
    const causeLabels = Array.from(causeCounts.keys());
    const causeData = Array.from(causeCounts.values());

    const customColors = causeLabels.map(label => {
        if (label.toLowerCase().includes('volcanic')) return '#2ecc71';
        return d3.schemeSet3[Math.floor(Math.random() * d3.schemeSet3.length)];
    });

    const donutCtx = document.getElementById('causeDonutChart').getContext('2d');

    new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: causeLabels,
            datasets: [{
                data: causeData,
                backgroundColor: customColors,
                borderColor: '#fff',
                borderWidth: 2,
                spacing: 1
            }]
        },
        options: {
            responsive: true,
            cutout: '55%',
            animation: { animateScale: true },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.chart._metasets[0].total;
                            const value = context.raw;
                            const percentage = ((value / total) * 100).toFixed(2);
                            return `${context.label}: ${value} events (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

}).catch(err => console.error("Error loading data:", err));

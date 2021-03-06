import React, { Component } from 'react';
import StartDate from './startdate.component';
import EndDate from './enddate.component';
import GasUsageStatsBar from './gasusagestatsbar.component';
import GasPriceStatsBar from './gaspricestatsbar.component';
import Axios from "axios"; 
import { Interface } from '@ethersproject/abi';
const Chart = require('chart.js');

const timeFactor = (1000 * 60 * 60 * 24);

function formatNumber(num) {
    const n = Math.abs(num); // Change to positive
    const floored = Math.floor(n)
    const decimal = n - floored
    return floored.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + decimal.toString();
}

export default class DateBar extends Component {
    constructor() {
      super();
      this.getTransactions = this.getTransactions.bind(this);
      this.submitTime = this.submitTime.bind(this);
      this.getOrganizedTransactions = this.getOrganizedTransactions.bind(this);
      this.makeChart = this.makeChart.bind(this);
      this.makeStats = this.makeStats.bind(this);
      this.displayTradingVolume = this.displayTradingVolume.bind(this);
      this.makeTradingVolChart = this.makeTradingVolChart.bind(this);
      this.getSwapData = this.getSwapData.bind(this);
      this.accessSwapData = this.accessSwapData.bind(this);
      this.makeFailuresChart = this.makeFailuresChart.bind(this);
      this.displayFailures = this.displayFailures.bind(this);

      this.state = {
        series: [],
        options: {}
      }
    }

    async submitTime () {
        var times = document.getElementsByName('datetime');
        if (times.length !== 2) {
            alert("One of your inputs is invalid. Please try again :)");
        } else {
            const start = new Date(times[0].value);
            const end = new Date(times[1].value);
            const transactions = await this.getTransactions(start, end);
            console.log(transactions[0]);
            const [usageStats, priceStats] = await this.getOrganizedTransactions(transactions);
            var unit = 'hour';

            await this.makeChart(usageStats[0], 'gasUsageChart', 'Gas Usage', 'line', unit);
            await this.makeStats(["maxGas", usageStats[1]], ["minGas", usageStats[2]], ["avgGas", usageStats[3]]);
            await this.makeChart(priceStats[0], 'gasPriceChart', 'Gas Price', 'line', unit);
            await this.makeStats(["maxGasPr", priceStats[1]], ["minGasPr", priceStats[2]], ["avgGasPr", priceStats[3]]);
            const j = await this.displayTradingVolume(transactions);
            await this.getSwapData(transactions);
            await this.displayFailures(transactions);
        }
    }

    async getTransactions(start, end) {
        return(
            Axios({
                method: "GET",
                url: "http://localhost:9000/getTransactions",
                headers: {
                "Content-Type": "application/json"
                },
                params: {
                    'start' : start,
                    'end' : end
                }
            }).then(res => {
                return res.data.transactions;
            })
        );
    }

    async getOrganizedTransactions(trx) {
        const trxLength = trx.length;
        var maxTx = null;
        var max = Number.MIN_VALUE;
        var minTx = null;
        var min = Number.MAX_VALUE;
        var avg = 0;

        var maxTxP = null;
        var maxP = Number.MIN_VALUE;
        var minTxP = null;
        var minP = Number.MAX_VALUE;
        var avgP = 0;

        var gasUsage = [];
        var gasPrices = [];

        for (var idx = 0; idx < trxLength; idx++) {
            const tx = trx[idx];
            const time = Number(tx.timeStamp);
            const gas = Number(tx.gasUsed);
            const gasPr = Number(tx.gasPrice);
            
            const theTime = time * 1000;
            
            gasUsage.push({
                x: theTime,
                y: gas
            });
            gasPrices.push({
                x: theTime,
                y: gasPr
            });


            if (gas > max) {
                maxTx = tx;
                max = gas;
            }

            if (gas < min) {
                minTx = tx;
                min = gas;
            }

            avg += gas;
            
            //Gas pricing collection

            if (gasPr > maxP) {
                maxTxP = tx;
                maxP = gasPr;
            }
      
            if (gasPr < minP) {
                minTxP = tx;
                minP = gasPr;
            }
      
            avgP += gasPr;
        }

        avg = avg / trxLength;
        avgP = avgP / trxLength;

        var usageStats = [gasUsage, formatNumber(max), formatNumber(min), formatNumber(avg)];
        var priceStats = [gasPrices, formatNumber(maxP), formatNumber(minP), formatNumber(avgP)];
        return [usageStats, priceStats];
    }

    async makeStats(max, min, avg) {
        var elem = document.getElementById(max[0]);
        elem.innerText = max[1];
        elem = document.getElementById(min[0]);
        elem.innerText = min[1];
        elem = document.getElementById(avg[0]);
        elem.innerText = avg[1];
    }

    async makeChart(data, id, label, graphType, unit) {
        var ctx = document.getElementById(id);
        new Chart(ctx, {
            type: graphType,
            data: {
                datasets: [{
                    label: label,
                    data: data
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }],
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: unit
                        },
                        distribution: 'linear'
                    }]
                }
            }
        });
    }

    async displayTradingVolume(trx) {
        var tradeVol = {}
        console.log("Starting trade Count");
        for (var idx = 0; idx < trx.length; idx++) {
            const tx = trx[idx]

            let day = new Date(Number(tx.timeStamp) * 1000);
            day = Math.floor(day.getTime()/timeFactor);
            console.log(day);
            if (day in tradeVol) {
                tradeVol[day] = tradeVol[day] + 1;
            } else {
                tradeVol[day] = 1;
            }
        }

        console.log("Starting data");
        var data = []
        Object.entries(tradeVol).forEach(([key, value]) => {
            data.push({
                x: key * timeFactor, 
                y: value
            })
        });

        console.log(data);

        const unit = 'day';
        const label = 'Trading Volume';
        await this.makeTradingVolChart('tradingVol', 'bar', label, data, unit)
    }

    async makeTradingVolChart(id, graphType, label, data, unit) {
        var ctx = document.getElementById(id);
        new Chart(ctx, {
            type: graphType,
            data: {
                datasets: [{
                    label: label,
                    data: data
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        }
                    }],
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: unit
                        },
                        distribution: 'linear'
                    }]
                }
            }
        });
    }

    async getSwapData(trx) {
        const sample = trx[0];
        this.accessSwapData(sample.input)

    }

    accessSwapData(input) {
        setTimeout(alert('Wait'), 6000);
        const proxyArtifact = require('./../abi/ExchangeProxy.json'); // See below
        console.log('starting proxy');
        console.log(proxyArtifact);

        const iface = new Interface(proxyArtifact.abi);

        let test = iface.parseTransaction({ data: input });
        console.log(test);
        console.log(test.args.swapSequences);
        console.log(test.functionFragment.name);
    }

    async displayFailures(trx) {
        var times = {};
        var failures = 0;
        var passes = 0;
        
        for (var idx = 0; idx < trx.length; idx++) {
            const tx = trx[idx]

            var contractExec = Number(tx.isError);
            var transactionExec = Number(tx.txreceipt_status);

            let contractExecFail = false;
            let transactionExecFail = false;

            if (contractExec == 1) {
                contractExecFail = true;
            } else if (transactionExec == 0) {
                transactionExecFail = true;
            }

            if(contractExec == 0 && transactionExec == 1){
                passes++;
            } else {
                failures++;
            }

            let day = new Date(Number(tx.timeStamp) * 1000);
            day = Math.floor(day.getTime()/timeFactor);
            console.log(day);

            //Check if day is present
            if (!(day in times)) {
                times[day] = {
                    'contract' : 0,
                    'transaction' : 0
                }
            } 
            
            if (contractExecFail) {
                times[day]['contract'] = times[day]['contract'] + 1;
            } else if (transactionExecFail) {
                times[day]['transaction'] = times[day]['transaction'] + 1;
            }

            times[day] = times[day];
        }

        var d = []
        var cFails = []
        var tFails = []

        Object.entries(times).forEach(([key, value]) => {
            d.push(key * timeFactor);
            Object.entries(value).forEach(([k, v]) => {
                if (k == 'contract') {
                    cFails.push(v);
                } else {
                    tFails.push(v);
                }
            })
        });

        const id = "failures";
        const labels = ['Contract Execution Error', 'Transaction Receipt Error'];
        const data = [d, cFails, tFails];
        const unit = 'day';
        this.makeFailuresChart(id, 'bar', labels, data, unit);
    }

    makeFailuresChart(id, graphType, labels, data, unit) {
        var ctx = document.getElementById(id);
        new Chart(ctx, {
            type: graphType,
            data: {
                labels: data[0],
                datasets: [{
                    type: 'bar',
                    label: labels[0],
                    data: data[1],
                    backgroundColor: "red"
                }, {   
                    type: 'bar',
                    label: labels[1],
                    data: data[2],
                    backgroundColor: "blue"
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true
                        },
                        stacked: true
                    }],
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: unit
                        },
                        distribution: 'linear',
                        stacked: true
                    }]
                }
            }
        });
    }

    render() {
    return (
        <div>
            <div className = "bar" style={{"display": "flex", 
                "justify-content": "space-around", "align":"center", "margin" : "0 auto"}}>
                <StartDate/>
                <EndDate/>
                <button onClick={this.submitTime} style={{"height": "30px", "margin-top" : "50px"}}>
                    Submit
                </button>
            </div>
            <div>
                <canvas id="gasUsageChart" width="400" height="100"></canvas>
                <GasUsageStatsBar/>
            </div>
            <div>
                <canvas id="gasPriceChart" width="400" height="100"></canvas>
                <GasPriceStatsBar/>
            </div>

            <div>
                <canvas id="tradingVol" width="400" height="100"></canvas>
            </div>
            
            <div>
                <canvas id="failures" width="400" height="100"></canvas>
            </div>
        </div>
    );
    }
}

//<EndDate/>
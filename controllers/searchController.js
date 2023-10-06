const request = require('request');
const soap = require('soap');
const xmlbuilder = require('xmlbuilder');
const axios = require('axios');
var qs = require('qs');
const querystring = require('querystring');
const xml2js = require('xml2js');
const { log } = require('console');

/**
 * @param {*} req 
 * @param {*} res 
 */

const post = async (req, res) => {




    //Esta es la variable que vamos a retornar con todos los datos de los vuelos 
    var KIU_AirPriceRS = [];



    //Aqui voy a Declarar todas las variables para busqueda de Disponibilidad "get_availability"
    const { body } = req;
    let FlightCcsMia;
    
    //Aqui declaro todas las variables para buscar los precios 

    //var PTC_FareBreakdowns = null;
    var newItinTotalFareCCSLRM = null;
    var newItinTotalFareLRMMIA = null;
    let PTC_FareBreakdowns = { PTC_FareBreakdown: [] };
    let codigos = [];
    // Aqui empieza la logica de buscar disponibilidad "get_availability"




    var options = {
		'method': 'POST',
		'url': 'https://kiuapi-stage.kiusys.net/agencies/air/get_availability',
		'headers': {
			'Content-Type': 'application/json',
			'KIU-API-Token': 'F8FB44EB731E90601DFC643CC4C66589'
		},
		body: JSON.stringify(body)
	};


    const promesa = new Promise((resolve, reject) => {
		request(options, (error, response) => {
			resolve({
				CCSLRM: JSON.parse(response.body)
			});
		});
	});


    const AvailabilityCCSMIA = await Promise.all([promesa]);


    const data = AvailabilityCCSMIA[0].CCSLRM;
    const CssMiaKey = Object.keys(data).find(key => key.includes("CCSMIA"));        

    // valido que la busqueda sea CCSMIA exactamente
    if(CssMiaKey == undefined){
        res.send({
            status: "Error",
            message: "Solamente CCS MIA"
        });
        return false;
    }


    
    //Aqui optengo todas las capas 
    const CapasCcsMia = data[CssMiaKey];


    //Pasos para encontrar una propiedad con FL00QL9962 dentro de todas las capas CapasCcsMia
    //Aqui recorro CapasCcsMia
    const KeyFlightsAvailables = Object.keys(CapasCcsMia);
    
    // Paso 2: Recorrer las claves
    for (const TheCurrentKey  of KeyFlightsAvailables) {
        // Paso 3: Verificar si la propiedad "FL00QL9962" existe en la propiedad actual
        if("FL00QL9962" in CapasCcsMia[TheCurrentKey]){
        
            FlightCcsMia = CapasCcsMia[TheCurrentKey];
            break; // Romper el bucle si se encuentra la propiedad

        }
    }


    if(FlightCcsMia == null){
        res.send({
            status: "Error",
            message: "No hay vuelos"
        });
        return false;
    }


    // si llega aqui si hay disponibilidad empiezo a llenar las variables para hacer la busqueda de precios CCSLRM
    // logica de busqueda de precios 

    
    const now = new Date();
    let departureLocationCodeIATA = FlightCcsMia.FL00QL9962.departure_information.airport_reference_id;
    departureLocationCodeIATA = departureLocationCodeIATA.replace('_0', '');
    let ArrivalLocationCodeIATA = FlightCcsMia.FL00QL9962.arrival_information.airport_reference_id;
    ArrivalLocationCodeIATA = ArrivalLocationCodeIATA.replace('_0', '');

    let echoToken = 'WS3DOCEXAMPLE';
    let timeStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(6, '0')}`;
    let agentSine = 'MIAAM8302';
    let terminalID = 'MIAAM83002';
    let isoCountry = 'US';
    let isoCurrency = 'USD';
    let departureDateTime = FlightCcsMia.FL00QL9962.departure_information.date +" "+ FlightCcsMia.FL00QL9962.departure_information.time;
    let arrivalDateTime = FlightCcsMia.FL00QL9962.arrival_information.date +" "+ FlightCcsMia.FL00QL9962.arrival_information.time;
    let flightNumber = FlightCcsMia.FL00QL9962.flight_number;
    let resBookDesigCode = FlightCcsMia.FL00QL9962.flight_additional_information.meal_service[0].meal_service_reference_id;
    let departureLocationCode = departureLocationCodeIATA;
    let arrivalLocationCode = ArrivalLocationCodeIATA;
    let marketingAirlineCode = 'QL'; //por ahora cableado pero deberia de ser dinamico 





    function getQuantityByCode(code) {
        const passengerType = body.AirTravelerAvail.PassengerTypeQuantities.find(item => item.Code === code);
        return passengerType ? passengerType.Quantity : 0;
    }

    function sumFares(fare1, fare2) {
        return {
            Amount: (parseFloat(fare1.Amount) + parseFloat(fare2.Amount)).toFixed(2).toString(),
            CurrencyCode: fare1.CurrencyCode // Asumimos que el CurrencyCode es el mismo en ambos casos
        };
    }
    

    function getFareDetailsByCode(Precios, code) {
        // Buscar en PTC_FareBreakdowns por el código del pasajero (ADT, CNN, INF)

        const breakdowns = Precios.PTC_FareBreakdowns[0].PTC_FareBreakdown;

        const breakdown = breakdowns.find(item => item.PassengerTypeQuantity[0].Code[0] === code);
        console.log(breakdowns, "riquiriqui")
    
        // Extraer BaseFare, EquivFare y Taxes

        const baseFare = {
            Amount: breakdown.PassengerFare[0].BaseFare[0].Amount[0],
            CurrencyCode: breakdown.PassengerFare[0].BaseFare[0].CurrencyCode[0]
        };
        const equivFare = {
            Amount: breakdown.PassengerFare[0].EquivFare[0].Amount[0],
            CurrencyCode: breakdown.PassengerFare[0].EquivFare[0].CurrencyCode[0]
        };
        const taxes = breakdown.PassengerFare[0].Taxes[0].Tax.map(tax => ({
            TaxCode: tax.TaxCode[0],
            Amount: tax.Amount[0],
            CurrencyCode: tax.CurrencyCode[0]
        }));
    
        return {
            BaseFare: baseFare,
            EquivFare: equivFare,
            Taxes: taxes
        };
    }



    let Request = `
                    <KIU_AirPriceRQ EchoToken="${echoToken}" TimeStamp="${timeStamp}" Target="Testing" Version="3.0" SequenceNmbr="1" PrimaryLangID="en-us">
                        <POS>
                            <Source AgentSine="${agentSine}" TerminalID="${terminalID}" ISOCountry="${isoCountry}" ISOCurrency="${isoCurrency}">
                                <RequestorID Type="5"></RequestorID>
                                <BookingChannel Type="1"></BookingChannel>
                            </Source>
                        </POS>
                        <AirItinerary>
                            <OriginDestinationOptions>
                                <OriginDestinationOption>
                                    <FlightSegment DepartureDateTime="${departureDateTime}" ArrivalDateTime="${arrivalDateTime}" FlightNumber="${flightNumber}" ResBookDesigCode="${resBookDesigCode}">
                                        <DepartureAirport LocationCode="${departureLocationCode}"></DepartureAirport>
                                        <ArrivalAirport LocationCode="${arrivalLocationCode}"></ArrivalAirport>
                                        <MarketingAirline Code="${marketingAirlineCode}"></MarketingAirline>
                                    </FlightSegment>
                                </OriginDestinationOption>
                            </OriginDestinationOptions>
                        </AirItinerary>
                        <TravelerInfoSummary>
                            <PriceRequestInformation></PriceRequestInformation>
                            <AirTravelerAvail>
                            <PassengerTypeQuantity Code="ADT" Quantity="${getQuantityByCode('ADT')}"></PassengerTypeQuantity>
                            <PassengerTypeQuantity Code="CNN" Quantity="${getQuantityByCode('CNN')}"></PassengerTypeQuantity>
                            <PassengerTypeQuantity Code="INF" Quantity="${getQuantityByCode('INF')}"></PassengerTypeQuantity>
                                
                        </AirTravelerAvail>
                        </TravelerInfoSummary>
                        </KIU_AirPriceRQ>`;
                           

    var DataPriceSearchCCSLRM = qs.stringify({
        'user': 'FEECORP',
        'password': '53!OPyrlCuR!398*',
        'request': Request
    });


    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://ssl00.kiusys.com/ws3/index.php',
        headers: { 
            'Content-type': 'application/x-www-form-urlencoded',
            'X-Forwarded-For': '169.45.250.115'
        },
        data : DataPriceSearchCCSLRM
    };

    
    const ResponseDataPriceSearchCCSLRM = await axios(config);
    

    const xml = ResponseDataPriceSearchCCSLRM.data;

    // Dentro de tu callback xml2js:
    xml2js.parseString(xml, { mergeAttrs: true }, (err, result) => {
        if (err) {
            throw err;
        }

        const Precios = result.KIU_AirPriceRS.PricedItineraries[0].PricedItinerary[0].AirItineraryPricingInfo[0];

        var CodigoPasajero = Precios.PTC_FareBreakdowns[0];

        console.log(CodigoPasajero, "2 cosas")

        CodigoPasajero.PTC_FareBreakdown.forEach(breakdown => {
            const passengerTypeQuantity = breakdown.PassengerTypeQuantity[0];
            const quantity = Number(passengerTypeQuantity.Quantity[0]);
            const code = passengerTypeQuantity.Code[0];
        
            if (quantity > 0) {
                codigos.push(code);
            }
        });
        
        console.log(codigos);

        const PreciosTotal = result.KIU_AirPriceRS.PricedItineraries[0].PricedItinerary[0].AirItineraryPricingInfo[0].ItinTotalFare[0];

     
        const Taxes = PreciosTotal.Taxes[0].Tax.map(tax => ({
            TaxCode: tax.TaxCode[0],
            Amount: tax.Amount[0],
            CurrencyCode: tax.CurrencyCode[0]
        }));
    
        const BaseFare = {
            Amount: PreciosTotal.BaseFare[0].Amount[0],
            CurrencyCode: PreciosTotal.BaseFare[0].CurrencyCode[0]
        };
    
        const EquivFare = {
            Amount: PreciosTotal.EquivFare[0].Amount[0],
            CurrencyCode: PreciosTotal.EquivFare[0].CurrencyCode[0]
        };
    
        const TotalFare = {
            Amount: PreciosTotal.TotalFare[0].Amount[0],
            CurrencyCode: PreciosTotal.TotalFare[0].CurrencyCode[0]
        };
    
        // Luego, puedes construir tu ItinTotalFare directamente
        newItinTotalFareCCSLRM = {
            BaseFare: BaseFare,
            EquivFare: EquivFare,
            Taxes: {
                Tax: Taxes
            },
            TPA_Extension: {
                Surcharges: {
                    Surcharge: [
                        {
                            FareChargeCode: "",
                            FareChargeAmount: "0.00"
                        }
                    ]
                }
            },
            TotalFare: TotalFare
        };
    

        const nuevosDatos = codigos.map(code => {
            const fareDetails = getFareDetailsByCode(Precios, code);

            // Si no encontramos detalles para este código, retornamos null.
            if (!fareDetails) {
                return null;
            }

            // Buscar el PTC_FareBreakdown existente con el mismo código
            const existingBreakdown = PTC_FareBreakdowns.PTC_FareBreakdown.find(b => b.PassengerTypeQuantity.Code === code);
            
            // Si existe un PTC_FareBreakdown con el mismo código, sumamos los valores. Si no, usamos los valores de la nueva consulta.
            const BaseFare = existingBreakdown 
                ? sumFares(existingBreakdown.PassengerFare.BaseFare, fareDetails.BaseFare)
                : fareDetails.BaseFare;

            const EquivFare = existingBreakdown 
                ? sumFares(existingBreakdown.PassengerFare.EquivFare, fareDetails.EquivFare)
                : fareDetails.EquivFare;

            const Taxes = existingBreakdown
                ? { Tax: [...existingBreakdown.PassengerFare.Taxes.Tax, ...fareDetails.Taxes] }
                : { Tax: fareDetails.Taxes };

            return {
                PassengerTypeQuantity: {
                    Quantity: getQuantityByCode(code),
                    Code: code
                },
                PassengerFare: {
                    BaseFare: BaseFare,
                    EquivFare: EquivFare,
                    Taxes: Taxes,
                    TPA_Extension: {
                        Surcharges: {
                            Surcharge: [{
                                FareChargeCode: "",
                                FareChargeAmount: "0.00"
                            }]
                        }
                    }
                }
            };
        });


        // Reemplazamos los valores existentes o agregamos los nuevos datos
        nuevosDatos.forEach(nuevo => {
            const index = PTC_FareBreakdowns.PTC_FareBreakdown.findIndex(b => b.PassengerTypeQuantity.Code === nuevo.PassengerTypeQuantity.Code);
            if (index !== -1) {
                PTC_FareBreakdowns.PTC_FareBreakdown[index] = nuevo; // Reemplaza el existente
            } else {
                PTC_FareBreakdowns.PTC_FareBreakdown.push(nuevo); // Agrega el nuevo
            }
        });


    });



    
    // si llega aqui si hay disponibilidad empiezo a llenar las variables para hacer la busqueda de precios LRMMIA
    // logica de busqueda de precios 



    let departureLocationCodeIATALRMMIA = FlightCcsMia.FL00L5201.departure_information.airport_reference_id;
    departureLocationCodeIATALRMMIA = departureLocationCodeIATALRMMIA.replace('_0', '');
    let ArrivalLocationCodeIATALRMMIA = FlightCcsMia.FL00L5201.arrival_information.airport_reference_id;
    ArrivalLocationCodeIATALRMMIA = ArrivalLocationCodeIATALRMMIA.replace('_0', '');

    let departureDateTimeLRMMIA = FlightCcsMia.FL00L5201.departure_information.date +" "+ FlightCcsMia.FL00L5201.departure_information.time;
    let arrivalDateTimeLRMMIA = FlightCcsMia.FL00L5201.arrival_information.date +" "+ FlightCcsMia.FL00L5201.arrival_information.time;
    let flightNumberLRMMIA = FlightCcsMia.FL00L5201.flight_number;
    let resBookDesigCodeLRMMIA = FlightCcsMia.FL00L5201.flight_additional_information.meal_service[0].meal_service_reference_id;
    let departureLocationCodeLRMMIA = departureLocationCodeIATALRMMIA;
    let arrivalLocationCodeLRMMIA = ArrivalLocationCodeIATALRMMIA;
    let marketingAirlineCodeLRMMIA = 'L5'; //por ahora cableado pero deberia de ser dinamico 

    
    let RequestLRMMIA = `
                    <KIU_AirPriceRQ EchoToken="${echoToken}" TimeStamp="${timeStamp}" Target="Testing" Version="3.0" SequenceNmbr="1" PrimaryLangID="en-us">
                        <POS>
                            <Source AgentSine="${agentSine}" TerminalID="${terminalID}" ISOCountry="${isoCountry}" ISOCurrency="${isoCurrency}">
                                <RequestorID Type="5"></RequestorID>
                                <BookingChannel Type="1"></BookingChannel>
                            </Source>
                        </POS>
                        <AirItinerary>
                            <OriginDestinationOptions>
                                <OriginDestinationOption>
                                    <FlightSegment DepartureDateTime="${departureDateTimeLRMMIA}" ArrivalDateTime="${arrivalDateTimeLRMMIA}" FlightNumber="${flightNumberLRMMIA}" ResBookDesigCode="${resBookDesigCodeLRMMIA}">
                                        <DepartureAirport LocationCode="${departureLocationCodeLRMMIA}"></DepartureAirport>
                                        <ArrivalAirport LocationCode="${arrivalLocationCodeLRMMIA}"></ArrivalAirport>
                                        <MarketingAirline Code="${marketingAirlineCodeLRMMIA}"></MarketingAirline>
                                    </FlightSegment>
                                </OriginDestinationOption>
                            </OriginDestinationOptions>
                        </AirItinerary>
                        <TravelerInfoSummary>
                            <PriceRequestInformation></PriceRequestInformation>
                            <AirTravelerAvail>
                                <PassengerTypeQuantity Code="ADT" Quantity="${getQuantityByCode('ADT')}"></PassengerTypeQuantity>
                                <PassengerTypeQuantity Code="CNN" Quantity="${getQuantityByCode('CNN')}"></PassengerTypeQuantity>
                                <PassengerTypeQuantity Code="INF" Quantity="${getQuantityByCode('INF')}"></PassengerTypeQuantity>
                            </AirTravelerAvail>
                        </TravelerInfoSummary>
                    </KIU_AirPriceRQ>`;





    var DataPriceSearchLRMMIA = qs.stringify({
        'user': 'FEECORP',
        'password': '53!OPyrlCuR!398*',
        'request': RequestLRMMIA
    });


    var configLRMMIA = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://ssl00.kiusys.com/ws3/index.php',
        headers: { 
            'Content-type': 'application/x-www-form-urlencoded',
            'X-Forwarded-For': '169.45.250.115'
        },
        data : DataPriceSearchLRMMIA
    };

    
    const ResponseDataPriceSearchLRMMIA = await axios(configLRMMIA);
  
    
    const xmlLRMMIA = ResponseDataPriceSearchLRMMIA.data;


    xml2js.parseString(xmlLRMMIA, { mergeAttrs: true }, (err, result) => {
        if (err) {
            throw err;
        }
        const Precios = result.KIU_AirPriceRS.PricedItineraries[0].PricedItinerary[0].AirItineraryPricingInfo[0];
        
        const PreciosTotal = result.KIU_AirPriceRS.PricedItineraries[0].PricedItinerary[0].AirItineraryPricingInfo[0].ItinTotalFare[0];

        const Taxes = PreciosTotal.Taxes[0].Tax.map(tax => ({
            TaxCode: tax.TaxCode[0],
            Amount: tax.Amount[0],
            CurrencyCode: tax.CurrencyCode[0]
        }));
    
        const BaseFare = {
            Amount: PreciosTotal.BaseFare[0].Amount[0],
            CurrencyCode: PreciosTotal.BaseFare[0].CurrencyCode[0]
        };
    
        const EquivFare = {
            Amount: PreciosTotal.EquivFare[0].Amount[0],
            CurrencyCode: PreciosTotal.EquivFare[0].CurrencyCode[0]
        };
    
        const TotalFare = {
            Amount: PreciosTotal.TotalFare[0].Amount[0],
            CurrencyCode: PreciosTotal.TotalFare[0].CurrencyCode[0]
        };
    
        // Luego, puedes construir tu ItinTotalFare directamente
        newItinTotalFareLRMMIA = {
            BaseFare: BaseFare,
            EquivFare: EquivFare,
            Taxes: {
                Tax: Taxes
            },
            TPA_Extension: {
                Surcharges: {
                    Surcharge: [
                        {
                            FareChargeCode: "",
                            FareChargeAmount: "0.00"
                        }
                    ]
                }
            },
            TotalFare: TotalFare
        };
    
        
        const nuevosDatos = codigos.map(code => {
            const fareDetails = getFareDetailsByCode(Precios, code);

            // Buscar el PTC_FareBreakdown existente con el mismo código
            const existingBreakdown = PTC_FareBreakdowns.PTC_FareBreakdown.find(b => b.PassengerTypeQuantity.Code === code);
            
            // Si existe un PTC_FareBreakdown con el mismo código, sumamos los valores. Si no, usamos los valores de la nueva consulta.
            const BaseFare = existingBreakdown 
                ? sumFares(existingBreakdown.PassengerFare.BaseFare, fareDetails.BaseFare)
                : fareDetails.BaseFare;

            const EquivFare = existingBreakdown 
                ? sumFares(existingBreakdown.PassengerFare.EquivFare, fareDetails.EquivFare)
                : fareDetails.EquivFare;

            const Taxes = existingBreakdown
                ? { Tax: [...existingBreakdown.PassengerFare.Taxes.Tax, ...fareDetails.Taxes] }
                : { Tax: fareDetails.Taxes };

            return {
                PassengerTypeQuantity: {
                    Quantity: getQuantityByCode(code),
                    Code: code
                },
                PassengerFare: {
                    BaseFare: BaseFare,
                    EquivFare: EquivFare,
                    Taxes: Taxes,
                    TPA_Extension: {
                        Surcharges: {
                            Surcharge: [{
                                FareChargeCode: "",
                                FareChargeAmount: "0.00"
                            }]
                        }
                    }
                }
            };
        });


        // Reemplazamos los valores existentes o agregamos los nuevos datos
        nuevosDatos.forEach(nuevo => {
            const index = PTC_FareBreakdowns.PTC_FareBreakdown.findIndex(b => b.PassengerTypeQuantity.Code === nuevo.PassengerTypeQuantity.Code);
            if (index !== -1) {
                PTC_FareBreakdowns.PTC_FareBreakdown[index] = nuevo; // Reemplaza el existente
            } else {
                PTC_FareBreakdowns.PTC_FareBreakdown.push(nuevo); // Agrega el nuevo
            }
        });

    });

  
    const combinedBaseFareAmount = parseFloat(newItinTotalFareCCSLRM.BaseFare.Amount) + parseFloat(newItinTotalFareCCSLRM.BaseFare.Amount);
    const combinedEquivFareAmount = parseFloat(newItinTotalFareCCSLRM.BaseFare.Amount) + parseFloat(newItinTotalFareCCSLRM.BaseFare.Amount);

    // Agregando todos los Taxes de los dos JSON
    const combinedTaxes = [...newItinTotalFareCCSLRM.Taxes.Tax, ...newItinTotalFareLRMMIA.Taxes.Tax];


    const combinedTotalFare = parseFloat(newItinTotalFareCCSLRM.TotalFare.Amount) + parseFloat(newItinTotalFareLRMMIA.TotalFare.Amount);
    // Creando el objeto resultante

    console.log(combinedTotalFare, "Precio perruno")

    const combinedJson = {
        ItinTotalFare: {
            BaseFare: { Amount: combinedBaseFareAmount.toFixed(2), CurrencyCode: "USD" },
            EquivFare: { Amount: combinedEquivFareAmount.toFixed(2), CurrencyCode: "USD" },
            Taxes: {
                Tax: combinedTaxes
            },
            TotalFare: { Amount: combinedTotalFare.toFixed(2), CurrencyCode: "USD" },
            // Aquí, puedes seguir añadiendo el resto de propiedades que desees.
        }
    };


    KIU_AirPriceRS.push({
        "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        EchoToken: "1",
        TimeStamp: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(6, '0')}`,
        Target: "Production",
        Version: "3.0",
        SequenceNmbr: "1",
        flights: "keyIda - keyVuelta",
        PricedItineraries: {
            PricedItinerary: [
                {
                    SequenceNumber: "1",
                    AirItinerary: {
                        OriginDestinationOptions: {
                            OriginDestinationOption: [
                                {
                                    FlightSegment: [
                                        {
                                            DepartureDateTime: departureDateTime,
                                            ArrivalDateTime: arrivalDateTime,
                                            FlightNumber: FlightCcsMia.FL00QL9962.flight_number,
                                            ResBookDesigCode: FlightCcsMia.FL00QL9962.flight_additional_information.meal_service[0].meal_service_reference_id,
                                            DepartureAirport: {
                                                LocationCode: departureLocationCodeIATA
                                            },
                                            ArrivalAirport: {
                                                LocationCode: ArrivalLocationCodeIATA
                                            },
                                            MarketingAirline: {
                                                Code: "QL" //Por los momentos cableado pero deberia de ser dinamico 
                                            }
                                        },
                                        {
                                            DepartureDateTime: departureDateTimeLRMMIA,
                                            ArrivalDateTime: arrivalDateTimeLRMMIA,
                                            FlightNumber: flightNumberLRMMIA,
                                            ResBookDesigCode: resBookDesigCodeLRMMIA,
                                            DepartureAirport: {
                                                LocationCode: ArrivalLocationCodeIATA
                                            },
                                            ArrivalAirport: {
                                                LocationCode: arrivalLocationCodeLRMMIA
                                            },
                                            MarketingAirline: {
                                                Code: "L5" // Por los momentos cableado pero deberia de ser dinamico 
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    },
                    AirItineraryPricingInfo: {
                        ItinTotalFare: combinedJson.ItinTotalFare,
                        PTC_FareBreakdowns
                    }
                }
            ]
        }

    });

   res.send(KIU_AirPriceRS);

};


module.exports = {

	post

};






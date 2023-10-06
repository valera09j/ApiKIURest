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

    const { body } = req;

    //Todas las variables que usaremos para guardado y llenado de formularios 
    var KIU_AirPriceRS = [];


    const extractedValues = [];
    let FlightCcsMia;
    let FlightMiaCss;

    var newItinTotalFareCCSLRM = null;
    var newItinTotalFareLRMMIA = null;
    var newItinTotalFareMIALRMRegreso = null;
    var newItinTotalFareLRMCCSRegreso = null;
    var newItinTotalFareMIALRMRegreso = null;
    var newItinTotalFareLRMCCSRegreso = null;
    let PTC_FareBreakdowns = { PTC_FareBreakdown: [] };
    let codigos = [];








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
				IdaYVueltaCCSMIA: JSON.parse(response.body)
			});
		});
	});



    const Disponibilidad = await Promise.all([promesa]);


    // Asumimos que siempre habrá un único objeto en el array
    const availabilityData = Disponibilidad[0].IdaYVueltaCCSMIA;

    // Iteramos a través de todas las propiedades del objeto
    for (const prop in availabilityData) {
        if (prop.startsWith("OD_")) {
            const extracted = prop.substring(3, 9); // Extraemos el subconjunto relevante del nombre de la propiedad
            extractedValues.push(extracted);
        }
    }

    console.log(extractedValues,"locote");

    if (!extractedValues.includes('CCSMIA') || !extractedValues.includes('MIACCS')) {
        res.send({
            status: "Error",
            message: "No hay disponibilidad para los vuelos elegidos"
        });
        return false;
    }





    const data = Disponibilidad[0].IdaYVueltaCCSMIA;
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

  
  

 






    //Aqui empieza el regreso 





    const dataRegreso = Disponibilidad[0].IdaYVueltaCCSMIA;
    const MiaCssKey = Object.keys(dataRegreso).find(key => key.includes("MIACCS"));        

    // valido que la busqueda sea CCSMIA exactamente
    if(MiaCssKey == undefined){
        res.send({
            status: "Error",
            message: "Solamente CCS MIA"
        });
        return false;
    }


    
    //Aqui optengo todas las capas 
    const CapasMiaCcss = dataRegreso[MiaCssKey];


    //Pasos para encontrar una propiedad con FL00QL9962 dentro de todas las capas CapasCcsMia
    //Aqui recorro CapasCcsMia
    const KeyFlightsAvailablesRegreso = Object.keys(CapasMiaCcss);
    
    // Paso 2: Recorrer las claves
    for (const TheCurrentKey  of KeyFlightsAvailables) {
        // Paso 3: Verificar si la propiedad "FL00QL9962" existe en la propiedad actual


        if("FL00QL9963" in CapasMiaCcss[TheCurrentKey]){
        
            FlightMiaCss = CapasMiaCcss[TheCurrentKey];
            break; // Romper el bucle si se encuentra la propiedad

        }
    }





    
    // si llega aqui si hay disponibilidad empiezo a llenar las variables para hacer la busqueda de precios CCSLRM
    // logica de busqueda de precios 



    console.log(FlightMiaCss, "oo shuruuuu")

    
    const nowRegreso = new Date();
    let departureLocationCodeIATARegreso = FlightMiaCss.FL00L5200.departure_information.airport_reference_id;
    departureLocationCodeIATARegreso = departureLocationCodeIATARegreso.replace('_0', '');
    let ArrivalLocationCodeIATARegreso = FlightMiaCss.FL00L5200.arrival_information.airport_reference_id;
    ArrivalLocationCodeIATARegreso = ArrivalLocationCodeIATARegreso.replace('_0', '');

    let echoTokenRegreso = 'WS3DOCEXAMPLE';
    let timeStampRegreso = `${nowRegreso.getFullYear()}-${String(nowRegreso.getMonth() + 1).padStart(2, '0')}-${String(nowRegreso.getDate()).padStart(2, '0')} ${String(nowRegreso.getHours()).padStart(2, '0')}:${String(nowRegreso.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(nowRegreso.getMilliseconds()).padStart(6, '0')}`;
    let agentSineRegreso = 'MIAAM8302';
    let terminalIDRegreso = 'MIAAM83002';
    let isoCountryRegreso = 'US';
    let isoCurrencyRegreso = 'USD';
    let departureDateTimeRegreso = FlightMiaCss.FL00L5200.departure_information.date +" "+ FlightMiaCss.FL00L5200.departure_information.time;
    let arrivalDateTimeRegreso = FlightMiaCss.FL00L5200.arrival_information.date +" "+ FlightMiaCss.FL00L5200.arrival_information.time;
    let flightNumberRegreso = FlightMiaCss.FL00L5200.flight_number;
    let resBookDesigCodeRegreso = FlightMiaCss.FL00L5200.flight_additional_information.meal_service[0].meal_service_reference_id;
    let departureLocationCodeRegreso = departureLocationCodeIATARegreso;
    let arrivalLocationCodeRegreso = ArrivalLocationCodeIATARegreso;
    let marketingAirlineCodeRegreso = 'L5'; //por ahora cableado pero deberia de ser dinamico 






    
    let RequestRegreso = `
                    <KIU_AirPriceRQ EchoToken="${echoTokenRegreso}" TimeStamp="${timeStampRegreso}" Target="Testing" Version="3.0" SequenceNmbr="1" PrimaryLangID="en-us">
                        <POS>
                            <Source AgentSine="${agentSineRegreso}" TerminalID="${terminalIDRegreso}" ISOCountry="${isoCountryRegreso}" ISOCurrency="${isoCurrencyRegreso}">
                                <RequestorID Type="5"></RequestorID>
                                <BookingChannel Type="1"></BookingChannel>
                            </Source>
                        </POS>
                        <AirItinerary>
                            <OriginDestinationOptions>
                                <OriginDestinationOption>
                                    <FlightSegment DepartureDateTime="${departureDateTimeRegreso}" ArrivalDateTime="${arrivalDateTimeRegreso}" FlightNumber="${flightNumberRegreso}" ResBookDesigCode="${resBookDesigCodeRegreso}">
                                        <DepartureAirport LocationCode="${departureLocationCodeRegreso}"></DepartureAirport>
                                        <ArrivalAirport LocationCode="${arrivalLocationCodeRegreso}"></ArrivalAirport>
                                        <MarketingAirline Code="${marketingAirlineCodeRegreso}"></MarketingAirline>
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
                           

    var DataPriceSearchLRMMIARegreso = qs.stringify({
        'user': 'FEECORP',
        'password': '53!OPyrlCuR!398*',
        'request': RequestRegreso
    });


    var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://ssl00.kiusys.com/ws3/index.php',
        headers: { 
            'Content-type': 'application/x-www-form-urlencoded',
            'X-Forwarded-For': '169.45.250.115'
        },
        data : DataPriceSearchLRMMIARegreso
    };

    
    const ResponseDataPriceSearchLRMMIARegreso = await axios(config);


    
    
    const xmlMIALRMRegreso = ResponseDataPriceSearchLRMMIARegreso.data;


      // Dentro de tu callback xml2js:
      xml2js.parseString(xmlMIALRMRegreso, { mergeAttrs: true }, (err, result) => {
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
        newItinTotalFareMIALRMRegreso = {
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


    const nowRegresoLRMCSS = new Date();
    let departureLocationCodeIATALRMCCSRegreso = FlightMiaCss.FL00QL9963.departure_information.airport_reference_id;
    departureLocationCodeIATALRMCCSRegreso = departureLocationCodeIATALRMCCSRegreso.replace('_0', '');
    let ArrivalLocationCodeIATALRMCCSRegreso = FlightMiaCss.FL00QL9963.arrival_information.airport_reference_id;
    ArrivalLocationCodeIATALRMCCSRegreso = ArrivalLocationCodeIATALRMCCSRegreso.replace('_0', '');

    let departureDateTimeLRMCCSRegreso = FlightMiaCss.FL00QL9963.departure_information.date +" "+ FlightMiaCss.FL00QL9963.departure_information.time;
    let arrivalDateTimeLRMCCSRegreso = FlightMiaCss.FL00QL9963.arrival_information.date +" "+ FlightMiaCss.FL00QL9963.arrival_information.time;
    let flightNumberLRMCCSRegreso = FlightMiaCss.FL00QL9963.flight_number;
    let resBookDesigCodeLRMCCSRegreso = FlightMiaCss.FL00QL9963.flight_additional_information.meal_service[0].meal_service_reference_id;
    let departureLocationCodeLRMCCSRegreso = departureLocationCodeIATALRMCCSRegreso;
    let arrivalLocationCodeLRMCCSRegreso = ArrivalLocationCodeIATALRMCCSRegreso;
    let marketingAirlineCodeLRMCCSRegreso = 'QL'; //por ahora cableado pero deberia de ser dinamico 
    let timeStampLRMCSSRegreso = `${nowRegresoLRMCSS.getFullYear()}-${String(nowRegresoLRMCSS.getMonth() + 1).padStart(2, '0')}-${String(nowRegresoLRMCSS.getDate()).padStart(2, '0')} ${String(nowRegresoLRMCSS.getHours()).padStart(2, '0')}:${String(nowRegresoLRMCSS.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(nowRegresoLRMCSS.getMilliseconds()).padStart(6, '0')}`;




    
    let RequestLRMCCSRegreso = `
                    <KIU_AirPriceRQ EchoToken="${echoToken}" TimeStamp="${timeStampLRMCSSRegreso}" Target="Testing" Version="3.0" SequenceNmbr="1" PrimaryLangID="en-us">
                        <POS>
                            <Source AgentSine="${agentSine}" TerminalID="${terminalID}" ISOCountry="${isoCountry}" ISOCurrency="${isoCurrency}">
                                <RequestorID Type="5"></RequestorID>
                                <BookingChannel Type="1"></BookingChannel>
                            </Source>
                        </POS>
                        <AirItinerary>
                            <OriginDestinationOptions>
                                <OriginDestinationOption>
                                    <FlightSegment DepartureDateTime="${departureDateTimeLRMCCSRegreso}" ArrivalDateTime="${arrivalDateTimeLRMCCSRegreso}" FlightNumber="${flightNumberLRMCCSRegreso}" ResBookDesigCode="${resBookDesigCodeLRMCCSRegreso}">
                                        <DepartureAirport LocationCode="${departureLocationCodeLRMCCSRegreso}"></DepartureAirport>
                                        <ArrivalAirport LocationCode="${arrivalLocationCodeLRMCCSRegreso}"></ArrivalAirport>
                                        <MarketingAirline Code="${marketingAirlineCodeLRMCCSRegreso}"></MarketingAirline>
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





    var DataPriceSearchLRMCCSRegreso = qs.stringify({
        'user': 'FEECORP',
        'password': '53!OPyrlCuR!398*',
        'request': RequestLRMCCSRegreso
    });


    var configLRMCSSRegreso = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://ssl00.kiusys.com/ws3/index.php',
        headers: { 
            'Content-type': 'application/x-www-form-urlencoded',
            'X-Forwarded-For': '169.45.250.115'
        },
        data : DataPriceSearchLRMCCSRegreso
    };

    
    const ResponseDataPriceSearchLRMCSSREgreso = await axios(configLRMCSSRegreso);





    const xmlLRMCSSRegreso = ResponseDataPriceSearchLRMCSSREgreso.data;


    xml2js.parseString(xmlLRMCSSRegreso, { mergeAttrs: true }, (err, result) => {
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
        newItinTotalFareLRMCCSRegreso = {
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







    const combinedBaseFareAmount = parseFloat(newItinTotalFareCCSLRM.BaseFare.Amount) + parseFloat(newItinTotalFareLRMMIA.BaseFare.Amount) + parseFloat(newItinTotalFareMIALRMRegreso.BaseFare.Amount) + parseFloat(newItinTotalFareLRMCCSRegreso.BaseFare.Amount);
    const combinedEquivFareAmount = parseFloat(newItinTotalFareCCSLRM.BaseFare.Amount) + parseFloat(newItinTotalFareLRMMIA.BaseFare.Amount) + parseFloat(newItinTotalFareMIALRMRegreso.BaseFare.Amount) + + parseFloat(newItinTotalFareLRMCCSRegreso.BaseFare.Amount);

    // Agregando todos los Taxes de los dos JSON
    const combinedTaxes = [...newItinTotalFareCCSLRM.Taxes.Tax, ...newItinTotalFareLRMMIA.Taxes.Tax, ...newItinTotalFareMIALRMRegreso.Taxes.Tax, ...newItinTotalFareLRMCCSRegreso.Taxes.Tax];


    const combinedTotalFare = parseFloat(newItinTotalFareCCSLRM.TotalFare.Amount) + parseFloat(newItinTotalFareLRMMIA.TotalFare.Amount) + parseFloat(newItinTotalFareMIALRMRegreso.TotalFare.Amount) + parseFloat(newItinTotalFareLRMCCSRegreso.TotalFare.Amount);
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
                            },
                            {
                                FlightSegment: [
                                    {
                                        DepartureDateTime: departureDateTimeRegreso,
                                        ArrivalDateTime: arrivalDateTimeRegreso,
                                        FlightNumber: FlightMiaCss.FL00L5200.flight_number,
                                        ResBookDesigCode: FlightMiaCss.FL00L5200.flight_additional_information.meal_service[0].meal_service_reference_id,
                                        DepartureAirport: {
                                            LocationCode: departureLocationCodeRegreso
                                        },
                                        ArrivalAirport: {
                                            LocationCode: arrivalLocationCodeRegreso
                                        },
                                        MarketingAirline: {
                                            Code: "L5" //Por los momentos cableado pero deberia de ser dinamico 
                                        }
                                    },
                                    {
                                        DepartureDateTime: departureDateTimeLRMCCSRegreso,
                                        ArrivalDateTime: arrivalDateTimeLRMCCSRegreso,
                                        FlightNumber: flightNumberLRMCCSRegreso,
                                        ResBookDesigCode: resBookDesigCodeLRMCCSRegreso,
                                        DepartureAirport: {
                                            LocationCode: departureLocationCodeLRMCCSRegreso
                                        },
                                        ArrivalAirport: {
                                            LocationCode: arrivalLocationCodeLRMCCSRegreso
                                        },
                                        MarketingAirline: {
                                            Code: "QL" // Por los momentos cableado pero deberia de ser dinamico 
                                        }
                                    }
                                ]
                            }
                        ],
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

}



module.exports = {

	post

};
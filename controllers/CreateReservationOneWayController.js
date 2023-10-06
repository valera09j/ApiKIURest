const request = require('request');
const soap = require('soap');
const xmlbuilder = require('xmlbuilder');
const axios = require('axios');
var qs = require('qs');
const querystring = require('querystring');
const xml2js = require('xml2js');
const { log } = require('console');

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */


const post = async (req, res) => {
    const { body } = req;

    //Estas son las variables que vamos a retornar con todos los datos de los vuelos 
    var KIU_AirBookRS = [];

    var FlightSegment = [];




    //Aqui estan todas las varibles necesarias para estructurar la respuesta que espera el controlador 
    var PNR = null;
    var PNRTimeUpdate = null;


     var options = {
         'method': 'POST',
         'url': 'https://kiuapi-stage.kiusys.net/agencies/services/create_booking',
         'headers': {
             'Content-Type': 'application/json',
             'KIU-API-Token': 'F8FB44EB731E90601DFC643CC4C66589'
         },
         body: JSON.stringify(body)
     };
 
 

     const promesa = new Promise((resolve, reject) => {
         request(options, (error, response) => {
             resolve({
                 CCSLRM_LRMMIA: JSON.parse(response.body)
                
             });
         });
     });
 


     //esta es la respuesta de la reserva CCSLRM_LRMMIA
     // se realizo la reserva pero ahora hay que añadir informacion de residencia y datos de los pasajeros tanto
     // al segmento CCSLRM como al segmento LRMMIA Aqui ira esa logica 

     var ResponseReserveCCSLRM_LRMMIA = await Promise.all([promesa]);


    //  console.log(ResponseReserveCCSLRM_LRMMIA[0], "aqui esta el beta");

    ResponseReserveCCSLRM_LRMMIA.forEach(item => {
        const flightsSegmentInfo = item.CCSLRM_LRMMIA.flights_segment_information;
        
        // Obtener todas las claves (nombres de las propiedades dinámicas)
        const keys = Object.keys(flightsSegmentInfo);
        
        keys.forEach(key => {
            const flightInfo = flightsSegmentInfo[key];
            
            // Aquí puedes acceder a flightInfo y usarlo como quieras.
            const segment = {
                DepartureDateTime: flightInfo.departure_information.date +" "+ flightInfo.departure_information.time,
                ArrivalDateTime: flightInfo.arrival_information.date + " " + flightInfo.arrival_information.time,
                FlightNumber: flightInfo.flight_number,
                ResBookDesigCode: flightInfo.reservation_booking_designator,
                DepartureAirport: {
                    LocationCode: flightInfo.departure_information.location_reference_id.split('_')[0]  // Asumo que "CCS" lo obtienes de alguna parte de flightInfo
                },
                ArrivalAirport: {
                    LocationCode: flightInfo.arrival_information.location_reference_id.split('_')[0]  // Asumo que "LRM" lo obtienes de alguna parte de flightInfo
                },
                MarketingAirline: {
                    Code: "03"  // Asumo que este código es fijo o que lo obtienes de alguna parte de flightInfo
                }
            };
            
            FlightSegment.push(segment);
        });
    });



        

    console.log(FlightSegment, "y llegamos")



     console.log(ResponseReserveCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator);

     //conseguimos PNR y la hora que ladilla 
     PNR = ResponseReserveCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator;
     PNRTimeUpdate = ResponseReserveCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator_version;


     // conseguimos los identificadores de segmentos 
     var keys = ResponseReserveCCSLRM_LRMMIA.map(response => {
      return Object.keys(response.CCSLRM_LRMMIA.flights_segment_information);
     });


     var [SegmentIdentifiers1, SegmentIdentifiers2] = keys.flat();

    
     
     console.log(SegmentIdentifiers1, SegmentIdentifiers2)





    // Filtramos los elementos que tienen la propiedad 'carrier' igual a 'L5'
    const filteredList = body.security_information_list.travel_document.filter(item => item.carrier === "L5");



   // Modificamos la lista para añadir la propiedad 'passenger_association_order'
    const modifiedList = filteredList.map(item => {
        const passengerInfo = body.passenger_information.find(
        p => p.foid_id === item.document_id
        );
        
        // Copiamos el objeto original para no modificar el objeto original
        const newItem = { ...item };
    
        // Quitamos la propiedad 'segment_association_list'
        delete newItem.segment_association_list;
    
        return {
        ...newItem,
        "segment_association_reference_key_list": [SegmentIdentifiers2],
        "passenger_association_order": passengerInfo ? passengerInfo.passenger_reference_order.toString() : undefined
        };
    });




     console.log(modifiedList, "locoteeeeeeeeeeeeeeeeeeeee");
     const noww = new Date();
    var modifi = {
        "date_time": `${noww.getFullYear()}-${String(noww.getMonth() + 1).padStart(2, '0')}-${String(noww.getDate()).padStart(2, '0')} ${String(noww.getHours()).padStart(2, '0')}:${String(noww.getMinutes()).padStart(2, '0')}:${String(noww.getSeconds()).padStart(2, '0')}.${String(noww.getMilliseconds()).padStart(6, '0')}`,
        "echo_token": "cc868541b95432615a13f084a1ab9364",
        "app_name": "ecommerce",
        "point_of_sale": {
            "user": "AGENCYFEECORP",
            "kiu_device_id": "MIAAM83002",
            "agent_id": "MIAAM8302",
            "preferred_display_currency": "USD",
            "country": "US",
            "agent_preferred_language": "es-AR"
        },
        "record_locator_version_information": {
            "record_locator": PNR,
            "record_locator_version": PNRTimeUpdate
        },
        "special_services_request": {
            "security_information_list": {
                "travel_document": modifiedList
            }
        }
    }
    


    var optionsModifi = {
        'method': 'POST',
        'url': 'https://kiuapi-stage.kiusys.net/agencies/services/modify_reservation_items',
        'headers': {
            'Content-Type': 'application/json',
            'KIU-API-Token': 'F8FB44EB731E90601DFC643CC4C66589'
        },
        body: JSON.stringify(modifi)
    };



    const promesaModifi = new Promise((resolve, reject) => {
        request(optionsModifi, (error, response) => {
            resolve({
                CCSLRM_LRMMIA: JSON.parse(response.body)
               
            });
        });
    });



    var ModifiCCSLRM_LRMMIA = await Promise.all([promesaModifi]);





    console.log(ModifiCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator, "que lacreo");

       

    const nowCotizar1 = new Date();
    var cotizar =     {
        "date_time": `${nowCotizar1.getFullYear()}-${String(nowCotizar1.getMonth() + 1).padStart(2, '0')}-${String(nowCotizar1.getDate()).padStart(2, '0')} ${String(nowCotizar1.getHours()).padStart(2, '0')}:${String(nowCotizar1.getMinutes()).padStart(2, '0')}:${String(nowCotizar1.getSeconds()).padStart(2, '0')}.${String(nowCotizar1.getMilliseconds()).padStart(6, '0')}`,
        "echo_token": "BOOKING_EXAMPLE",
        "point_of_sale": {
            "user": "AGENCYFEECORP",
            "kiu_device_id": "MIAAM83002",
            "agent_id": "MIAAM8302",
            "preferred_display_currency": "USD",
            "country": "US"
        },
        "record_locator_version_information": {
            "record_locator": ModifiCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator,
            "record_locator_version": ModifiCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator_version
        },
        "air_price": true,
        "air_price_options": {
            "segments_selection_list": [
                1
            ]
        }
    }




    var optionscotizar = {
        'method': 'POST',
        'url': 'https://kiuapi-stage.kiusys.net/agencies/services/price_booking',
        'headers': {
            'Content-Type': 'application/json',
            'KIU-API-Token': 'F8FB44EB731E90601DFC643CC4C66589'
        },
        body: JSON.stringify(cotizar)
    };



    const promesacotizar = new Promise((resolve, reject) => {
        request(optionscotizar, (error, response) => {
            resolve({
                CCSLRM_LRMMIA: JSON.parse(response.body)
               
            });
        });
    });



    var CotizarCCSLRM_LRMMIA = await Promise.all([promesacotizar]);



    console.log(CotizarCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information,"pago 1");



      

    const nowCotizar2 = new Date();
    var cotizar2 =     {
        "date_time": `${nowCotizar2.getFullYear()}-${String(nowCotizar2.getMonth() + 1).padStart(2, '0')}-${String(nowCotizar2.getDate()).padStart(2, '0')} ${String(nowCotizar2.getHours()).padStart(2, '0')}:${String(nowCotizar2.getMinutes()).padStart(2, '0')}:${String(nowCotizar2.getSeconds()).padStart(2, '0')}.${String(nowCotizar2.getMilliseconds()).padStart(6, '0')}`,
        "echo_token": "BOOKING_EXAMPLE",
        "point_of_sale": {
            "user": "AGENCYFEECORP",
            "kiu_device_id": "MIAAM83002",
            "agent_id": "MIAAM8302",
            "preferred_display_currency": "USD",
            "country": "US"
        },
        "record_locator_version_information": {
            "record_locator": CotizarCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator,
            "record_locator_version": CotizarCCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator_version
        },
        "air_price": true,
        "air_price_options": {
            "segments_selection_list": [
                2
            ]
        }
    }




    var optionscotizar = {
        'method': 'POST',
        'url': 'https://kiuapi-stage.kiusys.net/agencies/services/price_booking',
        'headers': {
            'Content-Type': 'application/json',
            'KIU-API-Token': 'F8FB44EB731E90601DFC643CC4C66589'
        },
        body: JSON.stringify(cotizar2)
    };



    const promesacotizar2 = new Promise((resolve, reject) => {
        request(optionscotizar, (error, response) => {
            resolve({
                CCSLRM_LRMMIA: JSON.parse(response.body)
               
            });
        });
    });



    var Cotizar2CCSLRM_LRMMIA = await Promise.all([promesacotizar2]);



    console.log(Cotizar2CCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information,"pago 2");




    // Datos de contacto
    const contactInfo = body.contact_information;

    // Buscamos y mapeamos los pasajeros
    const airTravelers = body.passenger_information.map(passenger => {
    return {
        "PassengerTypeCode": passenger.passenger_type_code === "ADT" ? "ADULT" : "CHILD", // Asume que hay dos tipos de pasajero: ADT y CHD
        "PersonName": {
        "GivenName": passenger.name,
        "Surname": passenger.surname
        },
        "Telephone": {
        "PhoneNumber": `${contactInfo.mobile_list[0].mobile_number}/${contactInfo.mobile_list[0].language_code}`
        },
        "Email": contactInfo.email_list[0].email_address,
        "Document": {
        "DocID": passenger.foid_id,
        "DocType": passenger.foid_type
        },
        "TravelerRefNumber": {
        "RPH": passenger.passenger_reference_order.toString()
        }
        };
    });

      
    const now = new Date();
    KIU_AirBookRS.push({
        "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        EchoToken: "1",
        TimeStamp: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(6, '0')}`,
        Target: "Production",
        Version: "3.0",
        SequenceNmbr: "1",
        AirItinerary: {
            OriginDestinationOptions: {

                OriginDestinationOption:[{FlightSegment : FlightSegment}],

            }
        },
        TravelerInfo:{
            AirTraveler:airTravelers 
        },
        BookingReferenceID:{
            Type:"1",
            ID: Cotizar2CCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator,
            RecordLocatorVersion: Cotizar2CCSLRM_LRMMIA[0].CCSLRM_LRMMIA.record_locator_version_information.record_locator_version
        }
    });


        
    res.send(KIU_AirBookRS[0]);

}



module.exports = {
	post
};
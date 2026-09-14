function status(request, response) {
  response.status(200).json({ "message": "Teste ok. É isso aí camarada!" });
}

export default status;
